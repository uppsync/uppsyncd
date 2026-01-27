import { beforeEach, describe, expect, it, mock } from "bun:test";
import { RaknetClient } from "./client";

// --- MOCK UDP CLIENT ---
const mockSend = mock();
const mockClose = mock();

mock.module("../../lib/udp-client", () => ({
	createUdpClient: async () => ({ send: mockSend, close: mockClose }),
}));

// --- PACKET HELPER ---
function createPong(payloadStr: string) {
	const magic = Buffer.from("00ffff00fefefefefdfdfdfd12345678", "hex");
	const payload = Buffer.from(payloadStr, "utf-8");
	const length = Buffer.alloc(2);
	length.writeUInt16BE(payload.length);

	return Buffer.concat([
		Buffer.from([0x1c]), // ID
		Buffer.alloc(8), // Time
		Buffer.alloc(8), // ServerGUID
		magic, // Magic
		length, // String Length (BE)
		payload, // String
	]);
}

describe("RaknetClient", () => {
	let client: RaknetClient;

	beforeEach(async () => {
		mockSend.mockReset();
		client = new RaknetClient("127.0.0.1", 19132);
	});

	it("should parse a valid Unconnected Pong", async () => {
		// Format: MCPE;Motd;Protocol;Version;Players;Max;Id;Map;Mode
		const raw =
			"MCPE;Dedicated Server;582;1.20.10;10;100;123456;Bedwars;Survival";
		const response = createPong(raw);

		mockSend.mockImplementation(async (_d, _p, _h, _t, _v) => response);

		const stats = await client.getStatus();

		expect(stats.edition).toBe("MCPE");
		expect(stats.motd).toBe("Dedicated Server");
		expect(stats.version).toBe("1.20.10");
		expect(stats.players).toBe(10);
		expect(stats.maxPlayers).toBe(100);
		expect(stats.gameMode).toBe("Survival");
	});

	it("should handle partial/malformed strings gracefully", async () => {
		const raw = "MCPE;ShortMsg"; // Missing fields
		const response = createPong(raw);

		mockSend.mockImplementation(async () => response);

		const stats = await client.getStatus();
		expect(stats.edition).toBe("MCPE");
		expect(stats.motd).toBe("ShortMsg");
		expect(stats.players).toBe(0); // Default fallback
	});
});
