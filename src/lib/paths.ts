import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function getAppDataDir(): string {
	const platform = os.platform();
	const homedir = os.homedir();
	let appDataDir: string;

	if (platform === "win32") {
		appDataDir =
			process.env.APPDATA || path.join(homedir, "AppData", "Roaming");
	} else if (platform === "darwin") {
		appDataDir = path.join(homedir, "Library", "Application Support");
	} else {
		// If running as a service (systemd), use the state directory directly.
		if (process.env.STATE_DIRECTORY) {
			const dbDir = process.env.STATE_DIRECTORY;
			fs.mkdirSync(dbDir, { recursive: true });
			return dbDir;
		}
		appDataDir =
			process.env.XDG_DATA_HOME || path.join(homedir, ".local", "share");
	}

	const dbDir = path.join(appDataDir, "uppsyncd");
	// Ensure directory exists
	fs.mkdirSync(dbDir, { recursive: true });

	return dbDir;
}

export function getDatabasePath(dbName = "metrics.sqlite"): string {
	return path.join(getAppDataDir(), dbName);
}

export function getPidFilePath(): string {
	// Use standard /run directory on Linux for global locking
	if (os.platform() === "linux") {
		return "/run/uppsyncd.pid";
	}
	return path.join(getAppDataDir(), "uppsyncd.pid");
}
