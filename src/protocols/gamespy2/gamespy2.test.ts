import { describe, expect, mock, test } from "bun:test";
import { GameSpy2Client } from "./client";

const createBuffer = (parts: (string | number)[]) => {
	const buffers: Buffer[] = [];
	for (const p of parts) {
		if (typeof p === "string") {
			buffers.push(Buffer.from(p, "latin1"), Buffer.from([0x00]));
		} else {
			buffers.push(Buffer.from([p]));
		}
	}
	return Buffer.concat(buffers);
};

mock.module("../../lib/udp-client", () => ({
	createUdpClient: async () => ({
		send: async (
			_buf: Buffer,
			_port: number,
			_ip: string,
			_timeout: number,
			validate: (chunk: Buffer, acc: Buffer[]) => Buffer | false,
		) => {
			// Coverage: Validation branches
			const short = Buffer.from([0x00]);
			const wrong = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00]);
			validate(short, [short]);
			validate(wrong, [wrong]);

			return createBuffer([
				0x00,
				0x01,
				0x02,
				0x03,
				0x04,
				"hostname",
				"Test",
				"",
				0x00,
				0x00,
				"player_",
				"score_",
				"",
				"Slayer",
				"10",
				0x00,
				0x00,
				"teamname_t",
				"",
				"Red",
			]);
		},
		close: () => {},
	}),
}));

describe("GameSpy2 Protocol", () => {
	const client = new GameSpy2Client("127.0.0.1", 2302);

	test("getStatus() full coverage", async () => {
		const status = await client.getStatus();

		expect(status.info.hostname).toBe("Test");

		// Use optional chaining to satisfy TS "possibly undefined"
		expect(status.players[0]?.player).toBe("Slayer");
		expect(status.players[0]?.score).toBe("10");
		expect(status.teams[0]?.teamname).toBe("Red");
	});

	test("parseTable() empty and custom routing coverage", async () => {
		const buf = createBuffer([
			0x00,
			0x01,
			0x02,
			0x03,
			0x04,
			"", // Header + Empty Info
			0x00,
			0x00,
			"", // Empty table
			0x00,
			0x00,
			"name",
			"",
			"Alice", // Player table (Halo style)
			0x00,
			0x00,
			"team",
			"",
			"Blue", // Team table
			0x01, // Delimiter break coverage
		]);

		const gs2 = new GameSpy2Client("1.1.1.1", 1);
		// @ts-expect-error: access private
		const res = gs2.parse(buf);

		expect(res.players[0]?.name).toBe("Alice");
		expect(res.teams[0]?.team).toBe("Blue");
	});
});
