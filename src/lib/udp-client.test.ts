import { afterEach, describe, expect, it } from "bun:test";
import { createUdpClient } from "./udp-client";

describe("UDP Client", () => {
	let socket: Bun.udp.Socket<"buffer"> | null = null;

	afterEach(() => {
		if (socket) {
			socket.close();
			socket = null;
		}
	});

	it("should resolve DNS, send data, and receive response", async () => {
		socket = await Bun.udpSocket({
			hostname: "127.0.0.1",
			port: 0,
			socket: {
				data(sock, buff, port, addr) {
					sock.send(buff, port, addr);
				},
			},
		});

		const client = await createUdpClient();

		// 127.0.0.1 triggers standard DNS fallback logic safely
		const response = await client.send(
			Buffer.from("HelloUDP"),
			socket.port,
			"127.0.0.1",
		);

		expect(response.toString()).toBe("HelloUDP");
		client.close();
	});

	it("should handle timeout if packet is lost", async () => {
		const client = await createUdpClient();

		// Send to random port with 50ms timeout
		const promise = client.send(Buffer.from("Lost"), 54321, "127.0.0.1", 50);

		await expect(promise).rejects.toThrow("Timeout waiting for response");
		client.close();
	});

	it("should validate and accumulate packets", async () => {
		socket = await Bun.udpSocket({
			hostname: "127.0.0.1",
			port: 0,
			socket: {
				data(sock, _buff, port, addr) {
					sock.send(Buffer.from("A"), port, addr);
					sock.send(Buffer.from("B"), port, addr);
				},
			},
		});

		const client = await createUdpClient();

		// Accumulates A and B
		const response = await client.send(
			Buffer.from("Go"),
			socket.port,
			"127.0.0.1",
			1000,
			(_chunk, acc) => {
				const total = Buffer.concat(acc).toString();
				return total.length === 2 ? Buffer.from(total) : false;
			},
		);

		expect(response.toString().length).toBe(2);
		client.close();
	});

	it("should reject if socket is busy (Concurrent requests)", async () => {
		socket = await Bun.udpSocket({
			hostname: "127.0.0.1",
			port: 0,
			socket: {
				async data(sock, buff, port, addr) {
					await Bun.sleep(50);
					sock.send(buff, port, addr);
				},
			},
		});

		const client = await createUdpClient();

		const p1 = client.send(Buffer.from("1"), socket.port, "127.0.0.1");
		const p2 = client.send(Buffer.from("2"), socket.port, "127.0.0.1");

		await expect(p2).rejects.toThrow("Socket is busy");

		await p1;
		client.close();
	});
});
