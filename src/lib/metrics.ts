import { Database } from "bun:sqlite";
import si from "systeminformation";
import { getDatabasePath } from "./paths";

export function startMetricsCollection() {
	const dbPath = getDatabasePath();
	console.log(`Metrics DB: ${dbPath}`);

	const db = new Database(dbPath);

	db.run(`
		CREATE TABLE IF NOT EXISTS queue (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			payload TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);
	`);

	db.run(
		`CREATE INDEX IF NOT EXISTS idx_queue_created ON queue(created_at ASC);`,
	);

	const cleanup = () => {
		console.log("Stopping metrics collection...");
		db.close();
	};

	process.on("SIGINT", () => {
		cleanup();
		process.exit(0);
	});
	process.on("SIGTERM", () => {
		cleanup();
		process.exit(0);
	});

	const insertStmt = db.prepare(
		"INSERT INTO queue (payload, created_at) VALUES (?, ?)",
	);

	const collectMetrics = async () => {
		try {
			const [cpu, mem, disk, fs, net, time] = await Promise.all([
				si.currentLoad(),
				si.mem(),
				si.disksIO(),
				si.fsSize(),
				si.networkStats(),
				si.time(),
			]);

			// 1. Get Main Disk (Root)
			const root = fs.find((d) => d.mount === "/") || fs[0];

			// 2. Aggregate Network (Sum of all interfaces)
			const rxTotal = net.reduce(
				(acc, iface) => acc + (iface.rx_bytes || 0),
				0,
			);
			const txTotal = net.reduce(
				(acc, iface) => acc + (iface.tx_bytes || 0),
				0,
			);

			const payload = {
				v: 1,
				ts: Date.now(),
				host: {
					uptime: Math.floor(time.uptime), // Seconds
				},
				cpu: {
					usage: parseFloat(cpu.currentLoad.toFixed(2)),
					load: [cpu.avgLoad, 0, 0],
				},
				mem: {
					total: mem.total,
					active: mem.active,
					swap_used: mem.swapused,
				},
				disk: {
					path: root?.mount ?? "unknown",
					used_pct: root ? parseFloat(root.use.toFixed(2)) : 0,
					// Handle nulls for IO (Docker containers often hide this)
					io_read: disk ? (disk.rIO_sec ?? 0) : 0,
					io_write: disk ? (disk.wIO_sec ?? 0) : 0,
				},
				net: {
					rx_total: rxTotal,
					tx_total: txTotal,
				},
			};

			console.log("machines/metrics:", JSON.stringify(payload));
			insertStmt.run(JSON.stringify(payload), Date.now());
		} catch (error) {
			console.error("Error collecting metrics:", error);
		}
	};

	// Collect metrics immediately and then every 60 seconds
	collectMetrics();
	setInterval(collectMetrics, 60000);

	console.log("Metrics collection started. Saving every 60s.");
}
