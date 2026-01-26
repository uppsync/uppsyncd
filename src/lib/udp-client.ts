type PendingRequest = {
	resolve: (buffer: Buffer) => void;
	reject: (error: Error) => void;
	accumulated: Buffer[];
	validate?: (chunk: Buffer, accumulated: Buffer[]) => Buffer | false;
};

export type UdpClient = {
	send: (
		data: Buffer,
		port: number,
		host: string,
		timeoutMs?: number,
		validate?: (chunk: Buffer, accumulated: Buffer[]) => Buffer | false,
	) => Promise<Buffer>;
	close: () => void;
};

export async function createUdpClient(): Promise<UdpClient> {
	let pending: PendingRequest | null = null;

	const socket = await Bun.udpSocket({
		socket: {
			// _socket implies unused parameter
			data(_socket, rawBuffer) {
				if (!pending) return;

				const chunk = Buffer.from(rawBuffer);
				pending.accumulated.push(chunk);

				if (!pending.validate) {
					pending.resolve(chunk);
					pending = null;
					return;
				}

				try {
					const result = pending.validate(chunk, pending.accumulated);
					if (result !== false) {
						pending.resolve(result);
						pending = null;
					}
				} catch (e) {
					if (pending) {
						pending.reject(e instanceof Error ? e : new Error(String(e)));
						pending = null;
					}
				}
			},
			error(_socket, error) {
				if (pending) {
					pending.reject(error);
					pending = null;
				}
			},
		},
	});

	return {
		send: async (data, port, host, timeoutMs = 2000, validate) => {
			// 1. DNS Resolution
			let ip = host;
			try {
				const addresses = await Bun.dns.lookup(host);
				// Safe access check
				if (addresses.length > 0 && addresses[0]) {
					ip = addresses[0].address;
				}
			} catch (_e) {
				// Ignore DNS failure, socket.send will likely throw if invalid
			}

			// 2. Send & Await
			return new Promise((resolve, reject) => {
				if (pending) {
					reject(new Error("Socket is busy"));
					return;
				}

				pending = { resolve, reject, validate, accumulated: [] };

				const sent = socket.send(data, port, ip);

				if (!sent) {
					pending = null;
					reject(new Error(`Failed to send packet to ${host} (${ip})`));
					return;
				}

				setTimeout(() => {
					if (pending) {
						pending.reject(
							new Error(`Timeout waiting for response from ${host}:${port}`),
						);
						pending = null;
					}
				}, timeoutMs);
			});
		},
		close: () => socket.close(),
	};
}
