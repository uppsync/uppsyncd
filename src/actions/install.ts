import { writeFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { $ } from "bun";
import type { RunOptions } from "../types";

export async function install(options: RunOptions) {
	const platform = process.platform;
	const execPath = await realpath(process.execPath);
	const isBun = execPath.endsWith("bun") || execPath.endsWith("bun.exe");

	let scriptPath = process.argv[1];
	if (isBun) {
		if (!scriptPath) {
			throw new Error(
				"Could not determine script path (process.argv[1] is undefined)",
			);
		}
		scriptPath = await realpath(scriptPath);
	} else {
		scriptPath = scriptPath ?? "";
	}

	console.log(`Installing uppsyncd service on ${platform}...`);

	try {
		if (platform === "linux") {
			await installLinux(execPath, scriptPath, isBun, options);
		} else {
			console.error(
				`Unsupported platform: ${platform}. Only Linux is supported.`,
			);
			process.exit(1);
		}
		console.log("uppsyncd service installed successfully.");
	} catch (error) {
		console.error("Failed to install service:", error);
		process.exit(1);
	}
}

async function installLinux(
	execPath: string,
	scriptPath: string,
	isBun: boolean,
	options: RunOptions,
) {
	const command = isBun ? `"${execPath}" "${scriptPath}"` : `"${execPath}"`;

	const envPath = "/etc/default/uppsyncd";
	const envContent = `# Managed by uppsyncd. Do not edit manually.
UPPSYNC_TOKEN=${options.token}
UPPSYNC_METRICS=${options.metrics ? "true" : "false"}
`;

	const servicePath = "/etc/systemd/system/uppsyncd.service";
	const serviceContent = `[Unit]
Description=Uppsync node agent
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
EnvironmentFile=${envPath}
ExecStart=${command} run
Restart=on-failure
RestartSec=5
StateDirectory=uppsyncd
StateDirectoryMode=0700

[Install]
WantedBy=multi-user.target
`;

	try {
		writeFileSync(envPath, envContent, { mode: 0o600 });
		writeFileSync(servicePath, serviceContent, { mode: 0o644 });
	} catch (e) {
		if ((e as { code?: string }).code === "EACCES") {
			console.error("Permission denied. Please run as root/sudo.");
			process.exit(1);
		}
		throw e;
	}

	await $`systemctl daemon-reload`;
	await $`systemctl enable uppsyncd`;
}
