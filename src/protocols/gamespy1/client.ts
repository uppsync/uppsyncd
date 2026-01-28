import { createUdpClient } from "../../lib/udp-client";

export interface GameSpy1Status {
	info: Record<string, string>;
	players: Record<string, string>[];
	teams: Record<string, string>[];
}

export class GameSpy1Client {
	constructor(
		private readonly host: string,
		private readonly port: number,
	) {}

	/**
	 * Sends a command and parses the response into a raw Key-Value map.
	 */
	public async sendCommand(
		command: string,
		waitForFinal: boolean,
	): Promise<Record<string, string>> {
		const client = await createUdpClient();

		try {
			const payload = Buffer.from(command, "latin1");

			const response = await client.send(
				payload,
				this.port,
				this.host,
				3000,
				(_chunk, accumulated) => {
					const total = Buffer.concat(accumulated);
					const text = total.toString("latin1");

					if (text.includes("\\final\\")) return total;
					if (!waitForFinal) return total;
					return false;
				},
			);

			const rawString = response.toString("latin1");
			const parts = rawString.split("\\");
			const data: Record<string, string> = {};

			// Parse \key\value
			for (let i = 1; i < parts.length; i += 2) {
				const key = parts[i];
				const value = parts[i + 1];

				if (key && value !== undefined) {
					const k = key.toLowerCase();
					if (k !== "final" && k !== "queryid") {
						data[k] = value;
					}
				}
			}

			return data;
		} finally {
			client.close();
		}
	}

	async getStatus(useXServerQuery = false): Promise<GameSpy1Status> {
		const cmd = useXServerQuery ? "\\status\\xserverquery\\" : "\\status\\";
		let raw: Record<string, string>;
		try {
			raw = await this.sendCommand(cmd, true);
		} catch {
			raw = await this.sendCommand(cmd, false);
		}
		return this.splitResponse(raw);
	}

	async getBasic(): Promise<Record<string, string>> {
		return await this.sendCommand("\\basic\\", false);
	}

	async getInfo(useXServerQuery = false): Promise<Record<string, string>> {
		const cmd = useXServerQuery ? "\\info\\xserverquery\\" : "\\info\\";
		return await this.sendCommand(cmd, false);
	}

	async getRules(useXServerQuery = false): Promise<Record<string, string>> {
		const cmd = useXServerQuery ? "\\rules\\xserverquery\\" : "\\rules\\";
		try {
			return await this.sendCommand(cmd, true);
		} catch {
			return await this.sendCommand(cmd, false);
		}
	}

	async getPlayers(useXServerQuery = false): Promise<Record<string, string>[]> {
		const cmd = useXServerQuery ? "\\players\\xserverquery\\" : "\\players\\";
		try {
			const raw = await this.sendCommand(cmd, true);
			return this.parseIndexedList(raw);
		} catch {
			const raw = await this.sendCommand(cmd, false);
			return this.parseIndexedList(raw);
		}
	}

	async getTeams(useXServerQuery = false): Promise<Record<string, string>[]> {
		const cmd = useXServerQuery ? "\\teams\\xserverquery\\" : "\\teams\\";
		try {
			const raw = await this.sendCommand(cmd, true);
			return this.parseIndexedList(raw);
		} catch {
			const raw = await this.sendCommand(cmd, false);
			return this.parseIndexedList(raw);
		}
	}

	async getEcho(message = "ping"): Promise<boolean> {
		try {
			const data = await this.sendCommand(`\\echo\\${message}`, false);
			const values = Object.values(data);
			const keys = Object.keys(data);
			return (
				values.includes(message) ||
				keys.includes(message) ||
				keys.includes("echo")
			);
		} catch {
			return false;
		}
	}

	// --- Helpers ---

	private splitResponse(raw: Record<string, string>): GameSpy1Status {
		const info: Record<string, string> = {};
		const playersMap: Record<number, Record<string, string>> = {};
		const teamsMap: Record<number, Record<string, string>> = {};

		for (const [key, value] of Object.entries(raw)) {
			const match = key.match(/^(.+)_(\d+)$/);

			// Ensure match, prop, and index exist
			if (match?.[1] && match[2]) {
				const prop = match[1];
				const id = parseInt(match[2], 10);

				if (prop.startsWith("teamname") || prop.startsWith("teamscore")) {
					if (!teamsMap[id]) teamsMap[id] = {};
					teamsMap[id][prop] = value;
				} else {
					if (!playersMap[id]) playersMap[id] = {};
					playersMap[id][prop] = value;
				}
			} else {
				info[key] = value;
			}
		}

		return {
			info,
			players: Object.values(playersMap),
			teams: Object.values(teamsMap),
		};
	}

	private parseIndexedList(
		rawData: Record<string, string>,
	): Record<string, string>[] {
		const listMap: Record<number, Record<string, string>> = {};

		for (const [key, value] of Object.entries(rawData)) {
			const match = key.match(/^(.+)_(\d+)$/);

			if (match?.[1] && match[2]) {
				const prop = match[1];
				const id = parseInt(match[2], 10);
				if (!listMap[id]) listMap[id] = {};
				listMap[id][prop] = value;
			}
		}

		return Object.values(listMap);
	}
}
