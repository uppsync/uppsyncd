import { existsSync, unlinkSync } from "node:fs";
import { $ } from "bun";

export async function uninstall() {
	const platform = process.platform;

	console.log(`Removing uppsyncd service on ${platform}...`);

	try {
		if (platform === "linux") {
			await removeLinux();
		} else {
			console.error(
				`Unsupported platform: ${platform}. Only Linux is supported.`,
			);
			process.exit(1);
		}
		console.log("uppsyncd service removed successfully.");
	} catch (error) {
		console.error("Failed to remove service:", error);
		process.exit(1);
	}
}

async function removeLinux() {
	const servicePath = "/etc/systemd/system/uppsyncd.service";

	// Invoke stop if possible
	await $`systemctl stop uppsyncd`.quiet().nothrow();
	await $`systemctl disable uppsyncd`.quiet().nothrow();

	if (existsSync(servicePath)) {
		try {
			unlinkSync(servicePath);
		} catch (e) {
			if ((e as { code?: string }).code === "EACCES") {
				console.error("Permission denied. Please run as root/sudo.");
				process.exit(1);
			}
			throw e;
		}
	}

	await $`systemctl daemon-reload`;
}
