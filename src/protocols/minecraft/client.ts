import { BufferReader } from "../../lib/buffer-reader";
import { createTcpClient } from "../../lib/tcp-client";

export interface JavaStatus {
	version: { name: string; protocol: number };
	players: {
		max: number;
		online: number;
		sample?: { name: string; id: string }[];
	};
	description: string;
	favicon?: string;
}

export class MinecraftJavaClient {
	constructor(
		private readonly host: string,
		private readonly port: number,
	) {}

	/**
	 * Reassembles TCP fragments by reading the Packet Length (VarInt) header.
	 */
	private validateFrame(buffer: Buffer): Buffer | false {
		let offset = 0;
		let length = 0;
		let shift = 0;
		let byte = 0;

		// 1. Read VarInt (Packet Length)
		while (true) {
			if (offset >= buffer.length) return false; // Wait for more data

			const val = buffer[offset];
			if (val === undefined) return false;
			byte = val;

			length |= (byte & 0x7f) << shift;
			shift += 7;
			offset++;
			if ((byte & 0x80) === 0) break;
		}

		// 2. Check if we have the full packet body
		// 'length' = size of PacketID + Data (excluding the VarInt length header itself)
		const totalNeeded = offset + length;

		if (buffer.length >= totalNeeded) {
			return buffer.subarray(0, totalNeeded);
		}

		return false; // Packet incomplete, keep accumulating
	}

	async getStatus(): Promise<JavaStatus> {
		const client = await createTcpClient(this.host, this.port);

		try {
			// --- 1. Handshake (ID 0x00, State 1) ---
			const portBuf = Buffer.alloc(2);
			portBuf.writeUInt16BE(this.port);

			const handshakeBody = Buffer.concat([
				Buffer.from([0x00]),
				this.varInt(47), // Proto 47 (1.8)
				this.varString(this.host),
				portBuf,
				this.varInt(1), // 1 = Status
			]);
			const handshake = Buffer.concat([
				this.varInt(handshakeBody.length),
				handshakeBody,
			]);

			// --- 2. Request (ID 0x00) ---
			const reqBody = Buffer.from([0x00]);
			const request = Buffer.concat([this.varInt(reqBody.length), reqBody]);

			// --- 3. Send & Receive (With Framing) ---
			const response = await client.send(
				Buffer.concat([handshake, request]),
				(buf) => this.validateFrame(buf),
			);

			// --- 4. Parse ---
			const reader = new BufferReader(response);
			const _len = reader.readVarInt();
			const id = reader.readVarInt();

			if (id !== 0x00) throw new Error(`Invalid Packet ID: ${id}`);

			const jsonStr = reader.readVarString();
			const raw = JSON.parse(jsonStr);

			return {
				version: {
					name: raw.version?.name || "Unknown",
					protocol: raw.version?.protocol || 0,
				},
				players: {
					max: raw.players?.max || 0,
					online: raw.players?.online || 0,
					sample: raw.players?.sample || [],
				},
				description:
					typeof raw.description === "string"
						? raw.description
						: raw.description?.text || "No MOTD",
				favicon: raw.favicon,
			};
		} finally {
			client.close();
		}
	}

	// --- Helpers ---

	private varInt(val: number): Buffer {
		const bytes = [];
		while (true) {
			if ((val & 0xffffff80) === 0) {
				bytes.push(val);
				break;
			}
			bytes.push((val & 0x7f) | 0x80);
			val >>>= 7;
		}
		return Buffer.from(bytes);
	}

	private varString(str: string): Buffer {
		const b = Buffer.from(str, "utf-8");
		return Buffer.concat([this.varInt(b.length), b]);
	}
}
