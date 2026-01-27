import { BufferReader } from "../../lib/buffer-reader";
import { createUdpClient } from "../../lib/udp-client";

const MAGIC = Buffer.from("00ffff00fefefefefdfdfdfd12345678", "hex");

export interface BedrockStatus {
	edition: string; // "MCPE"
	motd: string; // "Dedicated Server"
	protocol: number;
	version: string; // "1.20.10"
	players: number;
	maxPlayers: number;
	serverUniqueId: string;
	map: string;
	gameMode: string; // "Survival"
}

export class RaknetClient {
	constructor(
		private ip: string,
		private port: number,
	) {}

	async getStatus(): Promise<BedrockStatus> {
		const client = await createUdpClient();

		try {
			// --- 1. Send Unconnected Ping ---
			// ID (0x01) | Time (8b) | Magic (16b) | GUID (8b)
			const packet = Buffer.concat([
				Buffer.from([0x01]),
				Buffer.alloc(8),
				MAGIC,
				Buffer.alloc(8),
			]);

			const response = await client.send(packet, this.port, this.ip, 2000);

			// --- 2. Parse Unconnected Pong ---
			// ID (0x1C) | Time (8b) | ServerGUID (8b) | Magic (16b) | StringLen (2b) | String
			const reader = new BufferReader(response);
			const header = reader.readByte();

			if (header !== 0x1c) throw new Error("Invalid RakNet Header");

			reader.readBytes(8); // Time
			reader.readBytes(8); // ServerGUID
			reader.readBytes(16); // Magic

			// Read payload string (Length is a short BE)
			const strLen = reader.readUInt16BE();
			const raw = reader.readBytes(strLen).toString("utf-8");

			// Format: MCPE;Motd;Protocol;Version;Players;Max;Id;Map;Mode;...
			const p = raw.split(";");

			return {
				edition: p[0] || "Unknown",
				motd: p[1] || "",
				protocol: parseInt(p[2] || "0", 10),
				version: p[3] || "",
				players: parseInt(p[4] || "0", 10),
				maxPlayers: parseInt(p[5] || "0", 10),
				serverUniqueId: p[6] || "",
				map: p[7] || "",
				gameMode: p[8] || "",
			};
		} finally {
			client.close();
		}
	}
}
