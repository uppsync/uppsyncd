import { createWriteStream } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { $, semver } from "bun";
import pkg from "../../package.json";

export async function update() {
	console.log(`Checking for updates... (Current: ${pkg.version})`);

	let tempDir: string | null = null;

	try {
		const res = await fetch(
			"https://api.github.com/repos/uppsync/uppsyncd/releases/latest",
		);
		if (!res.ok) throw new Error(`Failed to fetch releases: ${res.statusText}`);

		const release = (await res.json()) as {
			tag_name: string;
			assets: { name: string; browser_download_url: string }[];
		};
		const latestVersion = release.tag_name.replace(/^v/, "");

		if (semver.order(latestVersion, pkg.version) <= 0) {
			console.log("You are already on the latest version.");
			return;
		}

		console.log(`New version available: ${latestVersion}`);

		// Resolve the real path of the current executable (handles symlinks)
		const currentPath = await realpath(process.execPath);

		if (process.platform === "linux") {
			// Check if managed by dpkg (Debian/Ubuntu)
			const isDebian =
				(await $`dpkg -S ${currentPath}`.quiet().nothrow()).exitCode === 0;
			if (isDebian) {
				console.log("\nThis installation is managed by apt/dpkg.");
				console.log(
					"Please use: sudo apt-get update && sudo apt-get install uppsyncd",
				);
				return;
			}

			// Check if managed by rpm (RHEL/CentOS)
			const isRpm =
				(await $`rpm -qf ${currentPath}`.quiet().nothrow()).exitCode === 0;
			if (isRpm) {
				console.log("\nThis installation is managed by dnf/rpm.");
				console.log("Please use: sudo dnf upgrade uppsyncd");
				return;
			}
		}

		// Determine Asset Name
		let assetName: string;
		if (process.platform === "win32") {
			assetName = "uppsyncd-windows-amd64.msi";
		} else if (process.platform === "darwin") {
			assetName = `uppsyncd-${process.arch === "arm64" ? "arm64" : "amd64"}.pkg`;
		} else {
			// Linux Binary
			const arch = process.arch === "x64" ? "amd64" : process.arch;
			assetName = `uppsyncd-linux-${arch}`;
		}

		const asset = release.assets.find((a) => a.name === assetName);
		if (!asset) {
			console.error(`No asset found for ${process.platform} (${assetName})`);
			return;
		}

		// SECURITY: Create a random, private temporary directory
		tempDir = await mkdtemp(join(tmpdir(), "uppsync-update-"));
		const tempFile = join(tempDir, assetName);

		console.log(`Downloading ${asset.browser_download_url}...`);

		const downloadRes = await fetch(asset.browser_download_url);
		if (!downloadRes.ok) throw new Error("Download failed");

		// Stream to file
		if (downloadRes.body) {
			await pipeline(downloadRes.body, createWriteStream(tempFile));
		}

		console.log("Installing...");

		if (process.platform === "win32") {
			// /qb = basic UI (progress bar), no cancel
			// /qn = no UI
			// /i = install
			await $`msiexec /i ${tempFile} /qb`;
		} else if (process.platform === "darwin") {
			console.log("Requesting root permissions to install...");
			await $`sudo installer -pkg ${tempFile} -target /`;
		} else {
			// Linux Binary Update
			console.log(`Replacing binary at ${currentPath}...`);
			await $`chmod +x ${tempFile}`;

			// Use mv -f to atomically replace the running binary
			// This might require sudo if the binary is in a protected directory
			try {
				await $`mv -f ${tempFile} ${currentPath}`;
			} catch (e) {
				if (e instanceof $.ShellError && e.exitCode === 1) {
					// Permission denied usually
					console.error("Permission denied. Please run with sudo.");
				}
				throw e;
			}
		}

		console.log("Update complete. Please restart the service/agent.");
	} catch (error) {
		console.error("Update failed:", error);
		process.exitCode = 1;
	} finally {
		// SECURITY: Always clean up the temp file
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	}
}
