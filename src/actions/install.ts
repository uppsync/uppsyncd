import {
	existsSync,
	readFileSync,
	type WriteFileOptions,
	writeFileSync,
} from "node:fs";
import { realpath } from "node:fs/promises";
import { $ } from "bun";
import type { RunOptions } from "../types";

function writeIfChanged(
	filePath: string,
	newContent: string,
	options?: WriteFileOptions,
): boolean {
	try {
		// 1. Check if file exists
		if (existsSync(filePath)) {
			// 2. Read old content
			const oldContent = readFileSync(filePath, "utf-8");
			// 3. Compare
			if (oldContent === newContent) {
				return false; // No change needed
			}
		}

		// 4. Write new content
		writeFileSync(filePath, newContent, options);
		return true; // Changed
	} catch (e) {
		// Handle permissions errors specifically
		if ((e as { code?: string }).code === "EACCES") {
			console.error(
				`Permission denied writing to ${filePath}. Run as root/sudo.`,
			);
			process.exit(1);
		}
		throw e;
	}
}

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
		let changed = false;

		if (platform === "linux") {
			changed = await installLinux(execPath, scriptPath, isBun, options);
		} else {
			console.error(
				`Unsupported platform: ${platform}. Only Linux is supported.`,
			);
			process.exit(1);
		}

		if (changed) {
			console.log("Configuration updated successfully.");
		} else {
			console.log("Configuration is up to date.");
		}

		return changed;
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
): Promise<boolean> {
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

	const envChanged = writeIfChanged(envPath, envContent, { mode: 0o600 });
	const serviceChanged = writeIfChanged(servicePath, serviceContent, {
		mode: 0o644,
	});

	if (serviceChanged) {
		console.log("Service definition changed, reloading daemon...");
		await $`systemctl daemon-reload`;
	}

	await $`systemctl enable uppsyncd`;

	return envChanged || serviceChanged;
}
