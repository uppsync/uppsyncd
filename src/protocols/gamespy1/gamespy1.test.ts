import { describe, expect, mock, test } from "bun:test";
import { GameSpy1Client } from "./client";

// --- Mocking the UDP Client ---
mock.module("../../lib/udp-client", () => {
	return {
		createUdpClient: async () => {
			return {
				send: async (
					buffer: Buffer,
					_port: number,
					_ip: string,
					_timeout: number,
					validate: (chunk: Buffer, acc: Buffer[]) => Buffer | false,
				) => {
					const cmd = buffer.toString("latin1");
					let raw = "";

					// 1. Basic
					if (cmd.includes("\\basic\\")) {
						raw = "\\gamename\\basetest\\final\\";
					}
					// 2. Info
					else if (cmd.includes("\\info\\")) {
						const safeCmd = cmd.includes("xserverquery")
							? "info_xsq"
							: "info_default";
						raw = `\\cmd\\${safeCmd}\\hostname\\InfoTest\\final\\`;
					}
					// 3. Status
					else if (cmd.includes("\\status\\")) {
						raw =
							"\\mapname\\de_dust\\" +
							"player_0\\PlayerOne\\score_0\\10\\" +
							"teamname_0\\RedTeam\\teamscore_0\\5\\" +
							"final\\";
					}
					// 4. Teams: Hybrid (Happy Path vs Timeout Path)
					else if (cmd.includes("\\teams\\")) {
						if (cmd.includes("xserverquery")) {
							// Success Path (Has \final\)
							raw = "\\teamname_0\\SuccessTeam\\final\\";
						} else {
							// Timeout Path (Missing \final\)
							raw = "\\teamname_0\\TimeoutTeam\\teamscore_0\\99\\";
						}
					}
					// 5. Rules: Hybrid
					else if (cmd.includes("\\rules\\")) {
						if (cmd.includes("xserverquery")) {
							raw = "\\gravity\\100\\final\\";
						} else {
							raw = "\\gravity\\800\\";
						}
					}
					// 6. Players: Hybrid
					else if (cmd.includes("\\players\\")) {
						if (cmd.includes("xserverquery")) {
							raw = "\\player_0\\SuccessPlayer\\final\\";
						} else {
							raw = "\\player_0\\TimeoutPlayer\\";
						}
					}
					// 7. Echo
					else if (cmd.includes("\\echo\\")) {
						raw = cmd;
					}
					// 8. Default (Catches unknown commands)
					else {
						raw = "\\final\\";
					}

					const responseBuffer = Buffer.from(raw, "latin1");

					if (validate) {
						const result = validate(responseBuffer, [responseBuffer]);
						if (result === false) {
							throw new Error("Simulated Timeout");
						}
						return result;
					}

					return responseBuffer;
				},
				close: () => {},
			};
		},
	};
});

describe("GameSpy1 Protocol", () => {
	const client = new GameSpy1Client("127.0.0.1", 7777);

	test("getBasic() returns simple key-value pairs", async () => {
		const data = await client.getBasic();
		expect(data).toBeDefined();
		expect(data.gamename).toBe("basetest");
	});

	test("getInfo() handles optional xserverquery parameter", async () => {
		const data1 = await client.getInfo();
		expect(data1.cmd).toBe("info_default");

		const data2 = await client.getInfo(true);
		expect(data2.cmd).toBe("info_xsq");
	});

	test("getStatus() splits response into info, players, and teams", async () => {
		const status = await client.getStatus();
		expect(status).toBeDefined();
		expect(status.info.mapname).toBe("de_dust");
		expect(status.players[0]?.player).toBe("PlayerOne");
		expect(status.teams[0]?.teamname).toBe("RedTeam");
	});

	test("getTeams() covers both success and fallback logic", async () => {
		// 1. Fallback (Default): Timeout -> Single Packet
		const teamsFallback = await client.getTeams();
		expect(teamsFallback[0]?.teamname).toBe("TimeoutTeam");

		// 2. Success (True): Returns \final\ -> Happy Path
		const teamsSuccess = await client.getTeams(true);
		expect(teamsSuccess[0]?.teamname).toBe("SuccessTeam");
	});

	test("getRules() covers both success and fallback logic", async () => {
		// 1. Fallback
		const rulesFallback = await client.getRules();
		expect(rulesFallback.gravity).toBe("800");

		// 2. Success
		const rulesSuccess = await client.getRules(true);
		expect(rulesSuccess.gravity).toBe("100");
	});

	test("getPlayers() covers both success and fallback logic", async () => {
		// 1. Fallback
		const playersFallback = await client.getPlayers();
		expect(playersFallback[0]?.player).toBe("TimeoutPlayer");

		// 2. Success
		const playersSuccess = await client.getPlayers(true);
		expect(playersSuccess[0]?.player).toBe("SuccessPlayer");
	});

	test("getEcho() verification", async () => {
		const result = await client.getEcho("ping");
		expect(result).toBe(true);
	});

	test("Raw sendCommand hits default mock path", async () => {
		// This hits the 'else' block in the Mock for 100% test file coverage
		const data = await client.sendCommand("\\unknown\\", false);
		expect(data).toBeDefined();
	});
});
