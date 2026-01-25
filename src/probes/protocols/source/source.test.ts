import { beforeEach, describe, expect, it, mock } from "bun:test";
import { SourceClient } from "./index";

// --- 1. MOCK NETWORK LAYER ---
const mockSend = mock();
const mockClose = mock();

mock.module("../../../lib/udp-client", () => ({
	createUdpClient: async () => ({ send: mockSend, close: mockClose }),
}));

// --- 2. PACKET HELPERS ---
const toBuf = (hex: string) => Buffer.from(hex.replace(/\s/g, ""), "hex");
const packet = (header: number, payload: string) =>
	Buffer.concat([
		Buffer.from([0xff, 0xff, 0xff, 0xff, header]),
		toBuf(payload),
	]);

function createSplits(header: number, payloadHex: string, isGoldSrc: boolean) {
	const data = Buffer.concat([
		Buffer.from([0xff, 0xff, 0xff, 0xff, header]),
		toBuf(payloadHex),
	]);
	const mid = Math.floor(data.length / 2);

	// Header Prefix: -2 (FE FF FF FF) + ID (1234)
	const prefix = Buffer.from([0xfe, 0xff, 0xff, 0xff, 0xd2, 0x04, 0x00, 0x00]);
	const chunks = [data.subarray(0, mid), data.subarray(mid)];

	return chunks.map((chunk, index) => {
		let meta: Buffer;
		if (isGoldSrc) {
			// GoldSrc: Packed Byte (High Nibble=Index, Low Nibble=Total)
			const packed = (index << 4) | 0x02; // Total 2
			meta = Buffer.from([packed]);
		} else {
			// Source: Total(1) + Num(1) + Size(2)
			meta = Buffer.from([0x02, index, 0x00, 0x05]);
		}
		return Buffer.concat([prefix, meta, chunk]);
	});
}

// --- 3. TEST SUITE ---
describe("SourceClient", () => {
	let client: SourceClient;

	beforeEach(async () => {
		mockSend.mockReset();
		client = new SourceClient("127.0.0.1", 27015);
		await client.connect();
	});

	it("should parse A2S_INFO (Source)", async () => {
		const response = packet(
			0x49,
			"11 5465737400 4d617000 4600 4700 0A00 02 10 00 64 77 00 00 3100",
		);

		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		const info = await client.getInfo();
		expect(info.name).toBe("Test");
		expect(info.map).toBe("Map");
		expect(info.players).toBe(2);
	});

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
		expect(list[0]?.name).toBe("Bob");
	});

	it("should parse A2S_RULES", async () => {
		// Header 0x45 + Count(2) + "R1"="V1" + "R2"="V2"
		const response = packet(0x45, "0200 523100 563100 523200 563200");

		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) =>
			validator(response, [response]),
		);

		const rules = await client.getRules();
		expect(rules).toHaveLength(2);
		expect(rules[0]).toEqual({ name: "R1", value: "V1" });
		expect(rules[1]).toEqual({ name: "R2", value: "V2" });
	});

	it("should reassemble Source Split (12-byte header)", async () => {
		const chunks = createSplits(
			0x49,
			"11 53726300 4d617000 4600 4700 0A00 00 00 00 64 77 00 00 3100",
			false,
		);

		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) => {
			let res = validator(chunks[1], [chunks[1]]);
			if (!res) res = validator(chunks[0], [chunks[1], chunks[0]]);
			return res;
		});

		const info = await client.getInfo();
		expect(info.name).toBe("Src");
	});

	it("should reassemble GoldSrc Split (9-byte header)", async () => {
		const chunks = createSplits(
			0x6d,
			"31323700 476f6c6400 4d00 4600 4700 02 10 11 64 77 00 00",
			true,
		);

		mockSend.mockImplementation(async (_d, _p, _i, _t, validator) => {
			return validator(chunks[1], [chunks[0], chunks[1]]);
		});

		const info = await client.getInfo();
		expect(info.name).toBe("Gold");
		expect(info.goldSrc?.address).toBe("127");
	});
});
