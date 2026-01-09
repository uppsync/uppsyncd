import { $ } from "bun";

export async function start(shouldRestart = false) {
	if (process.platform !== "linux") {
		console.error("Error: Service control is only supported on Linux.");
		process.exit(1);
	}

	try {
		if (shouldRestart) {
			console.log("Configuration updated. Restarting uppsyncd service...");
			await $`systemctl restart uppsyncd`;
			console.log("✓ Service restarted successfully.");
			return;
		}

		// Check if service is already running
		const status = await $`systemctl is-active uppsyncd`.nothrow().quiet();

		if (status.exitCode === 0) {
			console.log("✓ uppsyncd service is already running.");
			return;
		}

		console.log("Starting uppsyncd service...");
		await $`systemctl start uppsyncd`;
		console.log("✓ Service started successfully.");
	} catch (error) {
		console.error("Error: Failed to manage uppsyncd service.");
		if (error instanceof Error) {
			console.error(`Details: ${error.message}`);
			if (error.message.includes("Permission denied")) {
				console.error("Hint: This command requires root privileges (sudo).");
			}
		}
		process.exit(1);
	}
}

export async function stop() {
	if (process.platform !== "linux") {
		console.error("Only Linux is supported for service control.");
		process.exit(1);
	}
	try {
		await $`systemctl stop uppsyncd`;
		console.log("Service stopped.");
	} catch (e) {
		console.error("Failed to stop service:", e);
		process.exit(1);
	}
}

export async function restart() {
	if (process.platform !== "linux") {
		console.error("Only Linux is supported for service control.");
		process.exit(1);
	}
	try {
		await $`systemctl restart uppsyncd`;
		console.log("Service restarted.");
	} catch (e) {
		console.error("Failed to restart service:", e);
		process.exit(1);
	}
}

export async function status() {
	if (process.platform !== "linux") {
		console.error("Only Linux is supported for service control.");
		process.exit(1);
	}
	try {
		await $`systemctl status uppsyncd`;
	} catch (_e) {
		// systemctl status returns non-zero if service is not running
		process.exit(1);
	}
}
