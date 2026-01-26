import { createUdpClient, type UdpClient } from "../../../lib/udp-client";
import { parseInfo, parsePlayers, parseRules } from "./parsers";

const HEADERS = {
	REQ_INFO: Buffer.from([0xff, 0xff, 0xff, 0xff, 0x54]),
	REQ_PLAYER: Buffer.from([0xff, 0xff, 0xff, 0xff, 0x55]),
	REQ_RULES: Buffer.from([0xff, 0xff, 0xff, 0xff, 0x56]),

	RESP_INFO: 0x49,
	RESP_INFO_GOLD: 0x6d,
	RESP_PLAYER: 0x44,
	RESP_RULES: 0x45,
	RESP_CHALLENGE: 0x41,

	SPLIT: -2, // 0xFFFFFFFE
	SINGLE: -1, // 0xFFFFFFFF
};

const PAYLOADS = {
	INFO: Buffer.concat([
		Buffer.from("Source Engine Query"),
		Buffer.from([0x00]),
	]),
	CHALLENGE_INIT: Buffer.from([0xff, 0xff, 0xff, 0xff]),
};

export class SourceClient implements AsyncDisposable {
	private client: UdpClient | null = null;

	constructor(
		private ip: string,
		private port: number,
	) {}

	private async ensureConnection() {
		if (!this.client) {
			this.client = await createUdpClient();
		}
	}

	close() {
		this.client?.close();
		this.client = null;
	}

	async [Symbol.asyncDispose]() {
		this.close();
	}

	// --- PACKET VALIDATION LOGIC ---

	private matchesExpected(buffer: Buffer, expectedHeader: number): boolean {
		let payload = buffer;

		if (payload.length >= 4 && payload.readInt32LE(0) === HEADERS.SINGLE) {
			payload = payload.subarray(4);
		}
		if (payload.length === 0) return false;

		const type = payload.readUInt8(0);
		return (
			type === expectedHeader ||
			type === HEADERS.RESP_CHALLENGE ||
			(expectedHeader === HEADERS.RESP_INFO && type === HEADERS.RESP_INFO_GOLD)
		);
	}

	private tryGoldSrcReassembly(
		allChunks: Buffer[],
		expectedHeader: number,
	): Buffer | false {
		const first = allChunks[0];
		if (!first) return false;

		// GoldSrc: Packed Byte 8 (High Nibble=Index, Low Nibble=Total)
		const total = first.readUInt8(8) & 0x0f;

		if (allChunks.length < total) return false;

		allChunks.sort((a, b) => (a.readUInt8(8) >> 4) - (b.readUInt8(8) >> 4));
		const reassembled = Buffer.concat(allChunks.map((c) => c.subarray(9)));

		return this.matchesExpected(reassembled, expectedHeader)
			? reassembled
			: false;
	}

	private trySourceReassembly(
		allChunks: Buffer[],
		expectedHeader: number,
	): Buffer | false {
		const first = allChunks[0];
		if (!first) return false;

		// Source: Byte 8 is Total
		const total = first.readUInt8(8);

		if (allChunks.length < total) return false;

		allChunks.sort((a, b) => a.readUInt8(9) - b.readUInt8(9));
		const reassembled = Buffer.concat(allChunks.map((c) => c.subarray(12)));

		return this.matchesExpected(reassembled, expectedHeader)
			? reassembled
			: false;
	}

	private validatePacket(
		chunk: Buffer,
		allChunks: Buffer[],
		expectedHeader: number,
	): Buffer | false {
		const header = chunk.readInt32LE(0);

		if (header === HEADERS.SINGLE) {
			return this.matchesExpected(chunk, expectedHeader) ? chunk : false;
		}

		if (header === HEADERS.SPLIT) {
			const firstChunk = allChunks[0];
			// FIX: Explicit check ensures safety without non-null assertion (!)
			if (!firstChunk || firstChunk.length < 9) return false;

			// Strategy: Try GoldSrc first (packed byte), then Source
			const goldResult = this.tryGoldSrcReassembly(allChunks, expectedHeader);
			if (goldResult) return goldResult;

			const sourceResult = this.trySourceReassembly(allChunks, expectedHeader);
			if (sourceResult) return sourceResult;

			return false;
		}

		return false;
	}

	// --- CORE QUERY LOGIC ---

	private async query(
		reqHeader: Buffer,
		payload: Buffer,
		expectedResp: number,
	): Promise<Buffer> {
		await this.ensureConnection();
		if (!this.client) throw new Error("Client failed to initialize");

		const packet = Buffer.concat([reqHeader, payload]);
		const validator = (c: Buffer, a: Buffer[]) =>
			this.validatePacket(c, a, expectedResp);

		let response = await this.client.send(
			packet,
			this.port,
			this.ip,
			2000,
			validator,
		);

		if (response.length >= 4 && response.readInt32LE(0) === HEADERS.SINGLE) {
			response = response.subarray(4);
		}

		// Challenge Loop
		let attempts = 0;
		while (
			response.length > 0 &&
			response[0] === HEADERS.RESP_CHALLENGE &&
			attempts < 5
		) {
			attempts++;
			const challenge = response.subarray(1, 5);

			const finalPacket = reqHeader.equals(HEADERS.REQ_INFO)
				? Buffer.concat([reqHeader, payload, challenge])
				: Buffer.concat([reqHeader, challenge]);

			response = await this.client.send(
				finalPacket,
				this.port,
				this.ip,
				2000,
				validator,
			);

			if (response.length >= 4 && response.readInt32LE(0) === HEADERS.SINGLE) {
				response = response.subarray(4);
			}
		}

		if (attempts >= 5) throw new Error("Challenge loop detected");
		return response;
	}

	// --- PUBLIC API ---

	async getInfo() {
		return parseInfo(
			await this.query(HEADERS.REQ_INFO, PAYLOADS.INFO, HEADERS.RESP_INFO),
		);
	}

	async getPlayers() {
		return parsePlayers(
			await this.query(
				HEADERS.REQ_PLAYER,
				PAYLOADS.CHALLENGE_INIT,
				HEADERS.RESP_PLAYER,
			),
		);
	}

	async getRules() {
		return parseRules(
			await this.query(
				HEADERS.REQ_RULES,
				PAYLOADS.CHALLENGE_INIT,
				HEADERS.RESP_RULES,
			),
		);
	}
}
