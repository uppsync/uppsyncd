import { BufferReader } from "../../../lib/buffer-reader";

// --- TYPES ---

export interface SourceServerInfo {
	protocol: number;
	name: string;
	map: string;
	folder: string;
	game: string;
	appId: number;
	players: number;
	maxPlayers: number;
	bots: number;
	serverType: "dedicated" | "non-dedicated" | "sourcetv" | "unknown";
	environment: "linux" | "windows" | "mac" | "unknown";
	visibility: "public" | "private";
	vac: "unsecured" | "secured";
	version: string;
	port?: number;
	steamId?: bigint;
	keywords?: string;

	// Engine specific
	theShip?: { mode: number; witnesses: number; duration: number };
	goldSrc?: {
		address: string;
		isMod: boolean;
		link?: string;
		downloadLink?: string;
	};
}

export interface SourcePlayer {
	name: string;
	score: number;
	duration: number;
}

export interface SourceRule {
	name: string;
	value: string;
}

// --- PARSERS ---

export function parseInfo(buffer: Buffer): SourceServerInfo {
	const reader = new BufferReader(buffer);
	const header = reader.readByte();

	if (header === 0x49) return parseSourceInfo(reader);
	if (header === 0x6d) return parseGoldSrcInfo(reader);

	throw new Error(`Unknown A2S_INFO header: 0x${header.toString(16)}`);
}

function parseSourceInfo(reader: BufferReader): SourceServerInfo {
	const protocol = reader.readByte();
	const name = reader.readString();
	const map = reader.readString();
	const folder = reader.readString();
	const game = reader.readString();
	const appId = reader.readShort();
	const players = reader.readByte();
	const maxPlayers = reader.readByte();
	const bots = reader.readByte();
	const serverType = parseServerType(reader.readByte());
	const environment = parseEnvironment(reader.readByte());
	const visibility = reader.readByte() === 0 ? "public" : "private";
	const vac = reader.readByte() === 0 ? "unsecured" : "secured";

	// Explicit type to satisfy linter
	let theShip: SourceServerInfo["theShip"];

	if (appId === 2400) {
		theShip = {
			mode: reader.readByte(),
			witnesses: reader.readByte(),
			duration: reader.readByte(),
		};
	}

	const version = reader.readString();
	const info: SourceServerInfo = {
		protocol,
		name,
		map,
		folder,
		game,
		appId,
		players,
		maxPlayers,
		bots,
		serverType,
		environment,
		visibility,
		vac,
		version,
		theShip,
	};

	if (reader.remaining()) {
		const edf = reader.readByte();
		if (edf & 0x80) info.port = reader.readShort();
		if (edf & 0x10) info.steamId = reader.readLong();
		if (edf & 0x40) {
			reader.readShort();
			reader.readString();
		} // TV
		if (edf & 0x20) info.keywords = reader.readString();
		if (edf & 0x01) info.steamId = reader.readLong();
	}
	return info;
}

function parseGoldSrcInfo(reader: BufferReader): SourceServerInfo {
	const address = reader.readString();
	const name = reader.readString();
	const map = reader.readString();
	const folder = reader.readString();
	const game = reader.readString();
	const players = reader.readByte();
	const maxPlayers = reader.readByte();
	const protocol = reader.readByte();
	const serverType = parseServerType(reader.readByte());
	const environment = parseEnvironment(reader.readByte());
	const visibility = reader.readByte() === 0 ? "public" : "private";
	const isMod = reader.readByte() === 1;

	// Explicit type instead of 'any'
	const goldSrc: NonNullable<SourceServerInfo["goldSrc"]> = {
		address,
		isMod,
	};

	if (isMod) {
		goldSrc.link = reader.readString();
		goldSrc.downloadLink = reader.readString();
		reader.readByte(); // NULL
		reader.readInt(); // Version
		reader.readInt(); // Size
		reader.readByte(); // Type
		reader.readByte(); // DLL
	}

	const vac =
		reader.remaining() && reader.readByte() === 1 ? "secured" : "unsecured";
	const bots = reader.remaining() ? reader.readByte() : 0;

	return {
		protocol,
		name,
		map,
		folder,
		game,
		appId: 0,
		players,
		maxPlayers,
		bots,
		serverType,
		environment,
		visibility,
		vac,
		version: "1.0",
		goldSrc,
	};
}

export function parsePlayers(buffer: Buffer): SourcePlayer[] {
	const reader = new BufferReader(buffer);
	if (reader.readByte() !== 0x44) throw new Error("Invalid A2S_PLAYER header");

	const count = reader.readByte();
	const players: SourcePlayer[] = [];

	for (let i = 0; i < count; i++) {
		if (!reader.remaining()) break;
		reader.readByte(); // Index
		players.push({
			name: reader.readString(),
			score: reader.readInt(),
			duration: reader.readFloat(),
		});
	}
	return players;
}

export function parseRules(buffer: Buffer): SourceRule[] {
	const reader = new BufferReader(buffer);
	if (reader.readByte() !== 0x45) throw new Error("Invalid A2S_RULES header");

	const count = reader.readShort();
	const rules: SourceRule[] = [];

	for (let i = 0; i < count; i++) {
		if (!reader.remaining()) break;
		rules.push({ name: reader.readString(), value: reader.readString() });
	}
	return rules;
}

// --- HELPERS ---

function parseServerType(b: number): SourceServerInfo["serverType"] {
	switch (String.fromCharCode(b).toLowerCase()) {
		case "d":
			return "dedicated";
		case "l":
			return "non-dedicated";
		case "p":
			return "sourcetv";
		default:
			return "unknown";
	}
}

function parseEnvironment(b: number): SourceServerInfo["environment"] {
	switch (String.fromCharCode(b).toLowerCase()) {
		case "l":
			return "linux";
		case "w":
			return "windows";
		case "m":
		case "o":
			return "mac";
		default:
			return "unknown";
	}
}
