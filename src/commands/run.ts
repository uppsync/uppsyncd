import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { startMetricsCollection } from "../lib/metrics";
import { getPidFilePath } from "../lib/paths";

interface RunOptions {
	metrics?: boolean;
}

export async function run(options: RunOptions) {
	const pidFile = getPidFilePath();

	// Try to handle existing PID file
	if (existsSync(pidFile)) {
		try {
			const content = readFileSync(pidFile, "utf-8").trim();
			const pid = Number.parseInt(content, 10);

			if (Number.isNaN(pid)) {
				console.warn("Invalid PID file content (NaN), overwriting...");
			} else {
				// Check if process is running
				process.kill(pid, 0);
				console.error(`Error: uppsyncd is already running (PID: ${pid}).`);
				process.exit(1);
			}
		} catch (e) {
			const err = e as { code?: string };
			// Process IS running but we don't have permission to signal it
			if (err.code === "EPERM") {
				console.error(
					"Error: uppsyncd is already running (Permission denied to check PID).",
				);
				process.exit(1);
			}
			// Process not running (ESRCH), so the PID file is stale.
			// Or file vanished (ENOENT) during race condition.
			if (err.code !== "ESRCH" && err.code !== "ENOENT") {
				throw e;
			}
			if (err.code === "ESRCH") {
				console.warn("Found stale PID file, overwriting...");
			}
		}
	}

	try {
		writeFileSync(pidFile, process.pid.toString());
	} catch (e) {
		// If we can't write the PID file (e.g. permission denied in /run), we might fail or warn.
		console.warn(`Warning: Could not write PID file to ${pidFile}:`, e);
	}

	const cleanup = () => {
		try {
			if (existsSync(pidFile)) {
				// Only delete if it contains OUR pid
				const content = readFileSync(pidFile, "utf-8").trim();
				const pid = Number.parseInt(content, 10);
				if (pid === process.pid) {
					unlinkSync(pidFile);
				}
			}
		} catch (_e) {
			// ignore errors on cleanup
		}
	};

	process.on("exit", cleanup);
	process.on("SIGINT", () => {
		process.exit(0); // This triggers 'exit' event
	});
	process.on("SIGTERM", () => {
		process.exit(0);
	});

	console.log(`Starting uppsyncd agent (PID: ${process.pid})...`);

	if (options.metrics) {
		startMetricsCollection();
	} else {
		console.log("uppsyncd agent is running (no metrics).");
		// Keep alive
		setInterval(() => {}, 10000);
	}
}
