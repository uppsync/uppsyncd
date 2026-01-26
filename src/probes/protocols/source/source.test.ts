import { beforeEach, describe, expect, it, mock } from "bun:test";
import { SourceClient } from "./index";
import { parseInfo } from "./parsers";

// --- 1. MOCK NETWORK LAYER ---
const mockSend = mock();
const mockClose = mock();

mock.module("../../../lib/udp-client", () => ({
	createUdpClient: async () => ({ send: mockSend, close: mockClose }),
}));

// --- 2. PACKET HELPERS ---
const toBuf = (hex: string) => Buffer.from(hex.replace(/\s/g, ""), "hex");

const packet = (header: number, payloadHex: string) =>
	Buffer.concat([
		Buffer.from([0xff, 0xff, 0xff, 0xff, header]),
		toBuf(payloadHex),
	]);

// --- 3. TEST SUITE ---
describe("SourceClient", () => {
	let client: SourceClient;

	beforeEach(async () => {
		mockSend.mockReset();
		mockClose.mockReset();
		client = new SourceClient("127.0.0.1", 27015);
	});

	// --- STANDARD SOURCE TESTS ---

	it("should parse basic A2S_INFO (Source)", async () => {
		const response = packet(
			0x49,
			"11 5465737400 4d617000 466f6c64657200 47616d6500 0A00 02 10 00 64 77 00 00 312e302e3000",
		);
		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		const info = await client.getInfo();
		expect(info.name).toBe("Test");
		expect(info.serverType).toBe("dedicated");
		expect(info.environment).toBe("windows");
	});

	// --- COVERAGE: ENUMS & PARSING ---

	it("should parse Non-Dedicated ('l') and Linux ('l') environment", async () => {
		const response = packet(
			0x49,
			"11 4c697374656e00 4d00 4600 4700 0A00 00 00 00 6c 6c 00 00 3100",
		);
		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		const info = await client.getInfo();
		expect(info.serverType).toBe("non-dedicated");
		expect(info.environment).toBe("linux");
	});

	it("should parse SourceTV ('p') and Mac ('o')", async () => {
		const base = "11 545600 4d00 4600 4700 0A00 00 00 00 70 6f 00 00 3100";
		const extras = "40 3930 545600";
		const response = packet(0x49, base + extras);

		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		const info = await client.getInfo();
		expect(info.serverType).toBe("sourcetv");
		expect(info.environment).toBe("mac");
	});

	it("should handle unknown Enum values", async () => {
		const response = packet(
			0x49,
			"11 556e6b00 4d00 4600 4700 0A00 00 00 00 7a 7a 00 00 3100",
		);
		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		const info = await client.getInfo();
		expect(info.serverType).toBe("unknown");
		expect(info.environment).toBe("unknown");
	});

	it("should parse 'The Ship' specific data", async () => {
		const payload =
			"11 5368697000 4d00 4600 4700 6009 05 10 00 64 77 00 00 01 02 03 3100";
		const response = packet(0x49, payload);
		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		const info = await client.getInfo();
		expect(info.appId).toBe(2400);
		expect(info.theShip).toEqual({ mode: 1, witnesses: 2, duration: 3 });
	});

	it("should parse Extra Data Flags (Port, SteamID, Keywords)", async () => {
		const base = "11 45444600 4d00 4600 4700 0A00 00 00 00 64 77 00 00 3100";
		const extras = "B1 8769 0100000000000000 6b657900 0200000000000000";
		const response = packet(0x49, base + extras);
		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		const info = await client.getInfo();
		expect(info.port).toBe(27015);
		expect(info.keywords).toBe("key");
		expect(info.steamId?.toString()).toBe("2");
	});

	it("should parse GoldSrc with Mod Info, VAC, and Bots", async () => {
		const base = "31323700 476f6c6400 4d00 4600 4700 00 00 00 64 77 00";
		const modData = "01 75726c00 646c00 00 64000000 F4010000 01 01";
		const extraData = "01 05";
		const response = packet(0x6d, base + modData + extraData);

		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		const info = await client.getInfo();
		expect(info.goldSrc?.isMod).toBe(true);
		expect(info.vac).toBe("secured");
		expect(info.bots).toBe(5);
	});

	// --- COVERAGE: ERROR HANDLING ---

	it("should throw error when parsing invalid header directly", () => {
		const badPacket = Buffer.from([0x99, 0x00]);
		expect(() => parseInfo(badPacket)).toThrow("Unknown A2S_INFO header");
	});

	it("should reject malformed split packets (too short)", async () => {
		const malformedChunk = Buffer.from([
			0xfe, 0xff, 0xff, 0xff, 0x01, 0x00, 0x00, 0x00,
		]);
		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) => {
			const res = validator(malformedChunk, [malformedChunk]);
			expect(res).toBe(false);
			throw new Error("Timeout");
		});
		await expect(client.getInfo()).rejects.toThrow();
	});

	// --- STANDARD FUNCTIONALITY ---

	it("should handle Challenge Loops (A2S_PLAYER)", async () => {
		const challenge = packet(0x41, "DEADBEEF");
		const players = packet(0x44, "01 00 426f6200 00000000 00000000");

		let attempt = 0;
		mockSend.mockImplementation(async (data, _p, _i, _t, validator) => {
			attempt++;
			if (attempt === 1) return validator(challenge, [challenge]);
			expect(data.subarray(data.length - 4).toString("hex")).toBe("deadbeef");
			return validator(players, [players]);
		});

		const list = await client.getPlayers();
		expect(list).toHaveLength(1);
	});

	it("should parse A2S_RULES", async () => {
		const response = packet(0x45, "0200 523100 563100 523200 563200");
		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);
		const rules = await client.getRules();
		expect(rules).toHaveLength(2);
	});

	it("should reassemble Source Split", async () => {
		const data = Buffer.concat([
			Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49]),
			toBuf("11 53726300 4d00 4600 4700 0A00 00 00 00 64 77 00 00 3100"),
		]);
		const mid = Math.floor(data.length / 2);
		const prefix = Buffer.from([
			0xfe, 0xff, 0xff, 0xff, 0xd2, 0x04, 0x00, 0x00,
		]);
		const meta0 = Buffer.from([0x02, 0x00, 0x00, 0x05]);
		const meta1 = Buffer.from([0x02, 0x01, 0x00, 0x05]);

		const chunks = [
			Buffer.concat([prefix, meta0, data.subarray(0, mid)]),
			Buffer.concat([prefix, meta1, data.subarray(mid)]),
		];

		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) => {
			let res = validator(chunks[1], [chunks[1]]);
			if (!res) res = validator(chunks[0], [chunks[1], chunks[0]]);
			return res;
		});
		const info = await client.getInfo();
		expect(info.name).toBe("Src");
	});

	// --- COVERAGE: CLEANUP & DISPOSAL ---

	it("should close the client manually", async () => {
		const response = packet(
			0x49,
			"11 5465737400 4d617000 466f6c64657200 47616d6500 0A00 02 10 00 64 77 00 00 3100",
		);
		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		// Ensure connection is created
		await client.getInfo();

		// Manual Close
		client.close();
		expect(mockClose).toHaveBeenCalled();
	});

	it("should support async disposal", async () => {
		const response = packet(
			0x49,
			"11 5465737400 4d617000 466f6c64657200 47616d6500 0A00 02 10 00 64 77 00 00 3100",
		);
		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		{
			// 'await using' automatically calls [Symbol.asyncDispose] at end of scope
			await using scopedClient = new SourceClient("127.0.0.1", 27015);
			await scopedClient.getInfo();
		}

		expect(mockClose).toHaveBeenCalled();
	});
});
