import { BufferReader } from "../../lib/buffer-reader";
import { createUdpClient } from "../../lib/udp-client";

export interface GameSpy2Status {
	info: Record<string, string>;
	players: Record<string, string>[];
	teams: Record<string, string>[];
}

export class GameSpy2Client {
	constructor(
		private readonly host: string,
		private readonly port: number,
	) {}

	/**
	 * Fetches server status using the standard 11-byte GS2/3 query.
	 */
	async getStatus(): Promise<GameSpy2Status> {
		const client = await createUdpClient();

		try {
			const packet = Buffer.alloc(11);
			packet.writeUInt8(0xfe, 0);
			packet.writeUInt8(0xfd, 1);
			packet.writeUInt8(0x00, 2); // Status Request
			packet.writeUInt32BE(0x04050607, 3); // Session ID
			packet.writeUInt32BE(0xffffff01, 7); // Request: Info + Players + Teams

			const response = await client.send(
				packet,
				this.port,
				this.host,
				3000,
				(_chunk, accumulated) => {
					const total = Buffer.concat(accumulated);
					return total.length > 5 && total[0] === 0x00 ? total : false;
				},
			);

			return this.parse(response);
		} finally {
			client.close();
		}
	}

	private parse(buffer: Buffer): GameSpy2Status {
		const reader = new BufferReader(buffer);
		const result: GameSpy2Status = { info: {}, players: [], teams: [] };

		// 1. Skip Header (Type 0x00 + Session ID 4b)
		reader.readByte();
		reader.readBytes(4);

		// 2. Info Section (Key-Value strings until empty string)
		while (reader.remaining()) {
			const key = reader.readString("latin1");
			if (!key) break;
			result.info[key.toLowerCase()] = reader.readString("latin1");
		}

		// 3. Tabular Sections (Players/Teams)
		while (reader.remaining()) {
			if (reader.readByte() !== 0x00) break;
			if (reader.remaining()) reader.readByte(); // Skip Row Count/ID byte

			const table = this.parseTable(reader);
			const firstRow = table[0];

			// Guard check replaces the non-null assertion (!)
			if (!firstRow) continue;

			// Identify table type by checking fields of the first row
			const keys = Object.keys(firstRow);
			if (keys.includes("player") || keys.includes("name")) {
				result.players = table;
			} else if (keys.includes("team") || keys.includes("teamname")) {
				result.teams = table;
			}
		}

		return result;
	}

	/**
	 * Parses GameSpy tabular data.
	 * Handles null-terminated field lists and rows with no fixed count.
	 */
	private parseTable(reader: BufferReader): Record<string, string>[] {
		const fields: string[] = [];

		// Read Field Names until empty string
		while (reader.remaining()) {
			const f = reader.readString("latin1");
			if (!f) break;
			// Normalize: "player_" -> "player", "score_t" -> "score"
			fields.push(f.toLowerCase().replace(/(_t|_)$/, ""));
		}

		if (fields.length === 0) return [];

		const rows: Record<string, string>[] = [];

		// Read Rows until next section delimiter (0x00) or end of buffer
		while (reader.remaining() && reader.peek() !== 0x00) {
			const row: Record<string, string> = {};
			for (const field of fields) {
				row[field] = reader.readString("latin1");
			}
			rows.push(row);
		}

		return rows;
	}
}
