import { beforeEach, describe, expect, it, mock } from "bun:test";
import { MinecraftJavaClient } from "./client";

// --- MOCK TCP CLIENT ---
const mockSend = mock();
const mockClose = mock();

mock.module("../../../lib/tcp-client", () => ({
	createTcpClient: async () => ({ send: mockSend, close: mockClose }),
}));

// --- VARINT HELPER ---
function writeVarInt(val: number): Buffer {
	const bytes = [];
	while (true) {
		if ((val & 0xffffff80) === 0) {
			bytes.push(val);
			break;
		}
		// This path is now covered by generating a large packet
		bytes.push((val & 0x7f) | 0x80);
		val >>>= 7;
	}
	return Buffer.from(bytes);
}

function createSlpResponse(json: object) {
	const jsonStr = Buffer.from(JSON.stringify(json));

	// Packet Content: PacketID(0x00) + JSONString(VarIntLen + Bytes)
	const content = Buffer.concat([
		Buffer.from([0x00]),
		writeVarInt(jsonStr.length),
		jsonStr,
	]);

	// Frame: Length(VarInt) + Content
	return Buffer.concat([writeVarInt(content.length), content]);
}

describe("MinecraftJavaClient", () => {
	let client: MinecraftJavaClient;

	beforeEach(() => {
		mockSend.mockReset();
		client = new MinecraftJavaClient("127.0.0.1", 25565);
	});

	it("should parse a standard 1.7+ SLP response", async () => {
		const mockData = {
			version: { name: "1.20.4", protocol: 765 },
			players: { max: 20, online: 5, sample: [] },
			description: { text: "Hello World" },
		};
		const response = createSlpResponse(mockData);

		mockSend.mockImplementation(async (_data, validate) => {
			return validate(response);
		});

		const status = await client.getStatus();

		expect(status.version.name).toBe("1.20.4");
		expect(status.players.online).toBe(5);
		expect(status.description).toBe("Hello World");
	});

	it("should handle TCP fragmentation with large packets", async () => {
		// FIX: Use a string > 127 bytes.
		// This forces writeVarInt to encode length using multiple bytes, covering the missing lines.
		const longDescription = "A".repeat(150);

		const mockData = {
			description: longDescription,
		};
		const fullBuffer = createSlpResponse(mockData);

		// Split into 2 chunks
		const splitPoint = 3;
		const chunk1 = fullBuffer.subarray(0, splitPoint);
		const chunk2 = fullBuffer.subarray(splitPoint);

		mockSend.mockImplementation(async (_data, validate) => {
			// 1. First chunk (Incomplete)
			const attempt1 = validate(chunk1);
			expect(attempt1).toBe(false);

			// 2. Second chunk (Complete)
			const combined = Buffer.concat([chunk1, chunk2]);
			const attempt2 = validate(combined);
			expect(attempt2).not.toBe(false);

			return attempt2;
		});

		const status = await client.getStatus();
		expect(status.description).toBe(longDescription);
	});
});
