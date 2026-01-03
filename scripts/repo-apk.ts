import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

// --- CONFIGURATION ---
const REPO_DIR = "repo/alpine";
const INPUT_DIR = "dist";

// Default to 'stable', but allow override (e.g., 'unstable' for nightly)
const CHANNEL = process.env.CHANNEL || "stable";
const APK_PRIVATE_KEY = process.env.APK_PRIVATE_KEY; // Content of private key
let signingKeyPath: string | undefined;

async function setupKeys() {
	if (APK_PRIVATE_KEY) {
		console.log(
			"[REPO]    Setting up signing keys from environment variable...",
		);
		const abuildDir = join(homedir(), ".abuild");
		await mkdir(abuildDir, { recursive: true });

		const keyPath = join(abuildDir, "uppsync.rsa");
		// Ensure newline at end of key content just in case
		const keyContent = APK_PRIVATE_KEY.endsWith("\n")
			? APK_PRIVATE_KEY
			: `${APK_PRIVATE_KEY}\n`;

		await writeFile(keyPath, keyContent);
		await $`chmod 600 ${keyPath}`;

		// Generate public key
		const pubKeyPath = join(abuildDir, "uppsync.rsa.pub");
		console.log(`[REPO]    Deriving public key to ${pubKeyPath}...`);
		await $`openssl rsa -in ${keyPath} -pubout -out ${pubKeyPath}`;

		// Copy public key to root for S3 upload
		console.log(`[REPO]    Copying public key to workspace root...`);
		await copyFile(pubKeyPath, "uppsync.rsa.pub");

		signingKeyPath = keyPath;
		console.log(`[REPO]    Keys generated at ${keyPath}`);
	} else if (!signingKeyPath) {
		console.warn(
			"[WARN]    No APK_PRIVATE_KEY provided. Repository will not be signed.",
		);
	}
}

async function main() {
	console.log(`[REPO]    Initializing APK Repository generation`);
	console.log(`          Channel:  ${CHANNEL}`);
	console.log(`          Input:    ${INPUT_DIR}`);

	// 1. Setup Keys
	await setupKeys();

	// 2. Pre-flight Check
	try {
		const files = await readdir(INPUT_DIR);
		const apks = files.filter((f) => f.endsWith(".apk"));

		if (apks.length === 0) {
			console.error(`[ERROR] No .apk files found in '${INPUT_DIR}'.`);
			process.exit(1);
		}
		console.log(`[REPO]    Found ${apks.length} packages to index.`);
	} catch (_e) {
		console.error(`[ERROR] Directory '${INPUT_DIR}' does not exist.`);
		process.exit(1);
	}

	// 3. Process Files
	const files = await readdir(INPUT_DIR);
	for (const f of files) {
		if (!f.endsWith(".apk")) continue;

		// Parse Arch from filename (uppsyncd-linux-amd64.apk -> x86_64)
		let arch = "x86_64"; // Default
		if (f.includes("amd64") || f.includes("x86_64")) arch = "x86_64";
		else if (f.includes("arm64") || f.includes("aarch64")) arch = "aarch64";

		// Structure: repo/alpine/<channel>/<arch>/
		const targetDir = join(REPO_DIR, CHANNEL, arch);
		await mkdir(targetDir, { recursive: true });

		const srcPath = join(INPUT_DIR, f);
		const dstPath = join(targetDir, f);

		console.log(`[COPY]    ${f} -> ${targetDir}/`);
		await copyFile(srcPath, dstPath);

		// Sign the package individually (Professional Standard)
		if (signingKeyPath) {
			console.log(`[SIGN]    Signing ${f}...`);
			await $`abuild-sign -k ${signingKeyPath} ${dstPath}`;
		}
	}

	// 4. Generate Index
	const channelDir = join(REPO_DIR, CHANNEL);
	const archDirs = await readdir(channelDir);

	for (const arch of archDirs) {
		const dir = join(channelDir, arch);
		const indexFile = join(dir, "APKINDEX.tar.gz");

		console.log(`[INDEX]   Generating index for ${CHANNEL}/${arch}...`);

		try {
			// List all apk files in the directory
			const apkFiles = (await readdir(dir)).filter((f) => f.endsWith(".apk"));

			if (apkFiles.length === 0) continue;

			// Run apk index
			// We use --allow-untrusted because 'apk index' can be finicky about verifying
			// signatures of input packages in a CI environment, even if they are valid.
			// Since we explicitly signed them above, we know they are good.
			await $`apk index --allow-untrusted -v -o APKINDEX.tar.gz ${apkFiles}`.cwd(dir);

			// Sign the index
			if (signingKeyPath) {
				console.log(`[SIGN]    Signing index with ${signingKeyPath}...`);
				await $`abuild-sign -k ${signingKeyPath} APKINDEX.tar.gz`.cwd(dir);
			}

			console.log(`[SUCCESS] Index generated: ${indexFile}`);
		} catch (e) {
			if (e instanceof $.ShellError) {
				console.error(`[ERROR] Index generation failed for ${arch}`);
				console.error(e.stderr.toString());
				process.exit(e.exitCode || 1);
			}
			console.error("[ERROR] Unexpected error:", e);
			process.exit(1);
		}
	}
}

main();
