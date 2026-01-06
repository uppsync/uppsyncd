import { $ } from "bun";

export async function start() {
	if (process.platform !== "linux") {
		console.error("Only Linux is supported for service control.");
		process.exit(1);
	}
	try {
		await $`systemctl start uppsyncd`;
		console.log("Service started.");
	} catch (e) {
		console.error("Failed to start service:", e);
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
