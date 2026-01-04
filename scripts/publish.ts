import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { S3Client } from "bun";
import mime from "mime-types";

// --- CONFIGURATION ---
const ENDPOINT = process.env.S3_ENDPOINT;
const REGION = process.env.S3_REGION || "auto";
const BUCKET = process.env.S3_BUCKET;
const ACCESS_KEY = process.env.S3_ACCESS_KEY_ID;
const SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY;
const SUBPATH = process.env.S3_SUBPATH || "";

const LOCAL_DIR = "repo";

// Validation
if (!ENDPOINT || !BUCKET || !ACCESS_KEY || !SECRET_KEY) {
	console.error("[ERROR] Missing S3 Environment variables.");
	console.error(
		"        Required: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY",
	);
	process.exit(1);
}

const s3 = new S3Client({
	accessKeyId: ACCESS_KEY,
	secretAccessKey: SECRET_KEY,
	endpoint: ENDPOINT,
	bucket: BUCKET,
	region: REGION,
});

async function getFiles(dir: string): Promise<string[]> {
	const subdirs = await readdir(dir);
	const files = await Promise.all(
		subdirs.map(async (subdir) => {
			const res = join(dir, subdir);
			return (await stat(res)).isDirectory() ? getFiles(res) : res;
		}),
	);
	return files.flat();
}

async function main() {
	console.log(`[INFO]  Starting upload process`);
	console.log(`        Target: ${ENDPOINT}/${BUCKET}/${SUBPATH}`);
	console.log(`        Source: ${LOCAL_DIR}/`);

	try {
		const files = await getFiles(LOCAL_DIR);

		for (const filePath of files) {
			// 1. Calculate S3 Key
			// repo/dists/stable/Release -> uppsyncd/dists/stable/Release
			const relativePath = relative(LOCAL_DIR, filePath);
			// Ensure forward slashes for S3 paths even on Windows
			const s3Key = join(SUBPATH, relativePath).split("\\").join("/");

			// 2. Determine Content Type
			const mimeType = mime.lookup(filePath) || "application/octet-stream";

			console.log(`[UPLOAD] ${s3Key} (${mimeType})`);

			// 3. Upload
			const file = Bun.file(filePath);
			await s3.write(s3Key, file, {
				type: mimeType,
			});
		}

		console.log(`[SUCCESS] Repo upload complete.`);

		// --- Upload Root GPG Key (if exists) ---
		const rootKeys = ["uppsync.gpg", "uppsync.rsa.pub"];
		for (const keyFile of rootKeys) {
			const file = Bun.file(keyFile);
			if (await file.exists()) {
				console.log(`[UPLOAD] ${keyFile} (Root Key)`);
				const contentType = keyFile.endsWith(".pub")
					? "text/plain"
					: "application/pgp-keys";

				await s3.write(keyFile, file, {
					type: contentType,
				});
				console.log(`[SUCCESS] Root Key '${keyFile}' uploaded.`);
			} else {
				console.log(`[INFO]  No root '${keyFile}' found, skipping.`);
			}
		}
	} catch (error) {
		console.error("[ERROR] Upload failed:", error);
		process.exit(1);
	}
}

main();
