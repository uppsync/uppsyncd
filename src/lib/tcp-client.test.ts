import { afterEach, describe, expect, it } from "bun:test";
import { createTcpClient } from "./tcp-client";

describe("TCP Client", () => {
	let server: Bun.TCPSocketListener | null = null;

	// Ensure server stops after each test to prevent port leaks
	afterEach(() => {
		if (server) {
			server.stop();
			server = null;
		}
	});

	it("should connect and receive data", async () => {
		server = Bun.listen({
			hostname: "127.0.0.1",
			port: 0,
			socket: {
				data(socket, data) {
					socket.write(data);
				}, // Echo
			},
		});

		const client = await createTcpClient("127.0.0.1", server.port);
		const response = await client.send(Buffer.from("Ping"));

		expect(response.toString()).toBe("Ping");
		client.close();
	});

	it("should handle accumulation/validation (Framing)", async () => {
		server = Bun.listen({
			hostname: "127.0.0.1",
			port: 0,
			socket: {
				data(socket) {
					socket.write("Part1");
					setTimeout(() => socket.write("Part2"), 10);
				},
			},
		});

		const client = await createTcpClient("127.0.0.1", server.port);

		// Validator waits until full string is received
		const response = await client.send(Buffer.from("Go"), (buf) => {
			return buf.toString() === "Part1Part2" ? buf : false;
		});

		expect(response.toString()).toBe("Part1Part2");
		client.close();
	});

	it("should timeout if server does not reply", async () => {
		server = Bun.listen({
			hostname: "127.0.0.1",
			port: 0,
			socket: { data() {} }, // Silent
		});

		// 50ms timeout
		const client = await createTcpClient("127.0.0.1", server.port, 50);

		await expect(client.send(Buffer.from("Hello"))).rejects.toThrow(
			"TCP Timeout",
		);
		client.close();
	});

	it("should reject if socket is busy (Concurrent requests)", async () => {
		server = Bun.listen({
			hostname: "127.0.0.1",
			port: 0,
			socket: {
				// Keep socket busy by delaying the echo
				data(socket, data) {
					setTimeout(() => socket.write(data), 50);
				},
			},
		});

		const client = await createTcpClient("127.0.0.1", server.port);

		// 1. Send first request (goes pending)
		const req1 = client.send(Buffer.from("Req1"));

		// 2. Send second immediately (should throw busy)
		const req2 = client.send(Buffer.from("Req2"));

		await expect(req2).rejects.toThrow("Socket busy");

		// Cleanup
		await req1;
		client.close();
	});
});
