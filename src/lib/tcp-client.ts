type PendingRequest = {
	resolve: (buffer: Buffer) => void;
	reject: (error: Error) => void;
	accumulated: Buffer[]; // Store chunks here
	validate?: (accumulated: Buffer) => Buffer | false;
};

export async function createTcpClient(
	host: string,
	port: number,
	timeoutMs = 3000,
) {
	let pending: PendingRequest | null = null;

	return new Promise<{
		send: (
			data: Buffer,
			validate?: (buf: Buffer) => Buffer | false,
		) => Promise<Buffer>;
		close: () => void;
	}>((resolve, reject) => {
		Bun.connect({
			hostname: host,
			port: port,
			socket: {
				data(socket, data) {
					if (!pending) return;

					const chunk = Buffer.from(data);
					pending.accumulated.push(chunk);

					// Combine all chunks received so far
					const totalBuffer = Buffer.concat(pending.accumulated);

					// If no validator, behave like old version (resolve on first chunk)
					// (Not recommended for Minecraft, but kept for compatibility)
					if (!pending.validate) {
						pending.resolve(totalBuffer);
						pending = null;
						socket.end();
						return;
					}

					try {
						const result = pending.validate(totalBuffer);
						if (result !== false) {
							pending.resolve(result);
							pending = null;
							socket.end(); // Close connection after success
						}
					} catch (e) {
						if (pending) {
							pending.reject(e instanceof Error ? e : new Error(String(e)));
							pending = null;
							socket.end();
						}
					}
				},
				open(socket) {
					resolve({
						send: (data: Buffer, validate) => {
							return new Promise((res, rej) => {
								if (pending) {
									rej(new Error("Socket busy"));
									return;
								}

								pending = {
									resolve: res,
									reject: rej,
									accumulated: [],
									validate,
								};

								const flushed = socket.write(data);
								if (!flushed) {
									pending = null;
									rej(new Error("TCP Write Failed"));
									return;
								}

								setTimeout(() => {
									if (pending) {
										pending.reject(new Error(`TCP Timeout ${host}:${port}`));
										pending = null;
										socket.end();
									}
								}, timeoutMs);
							});
						},
						close: () => socket.end(),
					});
				},
				error(_socket, error) {
					if (pending) pending.reject(error);
					else reject(error);
				},
				connectError(_socket, error) {
					reject(error);
				},
			},
		});
	});
}
