import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
	region: REGION,
	endpoint: ENDPOINT,
	credentials: {
		accessKeyId: ACCESS_KEY,
		secretAccessKey: SECRET_KEY,
	},
	forcePathStyle: true, // Required for generic S3/R2 compatibility
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

			// 3. Determine Cache Strategy
			// Binaries (.deb) = Cache forever (Immutable)
			// Metadata (Release, Packages, GPG) = Cache short (Mutable)
			let cacheControl = "public, max-age=60, must-revalidate";

			if (filePath.endsWith(".deb")) {
				cacheControl = "public, max-age=31536000, immutable";
			}

			console.log(`[UPLOAD] ${s3Key} (${mimeType})`);

			// 4. Upload
			const fileContent = await readFile(filePath);
			await s3.send(
				new PutObjectCommand({
					Bucket: BUCKET,
					Key: s3Key,
					Body: fileContent,
					ContentType: mimeType,
					CacheControl: cacheControl,
				}),
			);

			// 5. Special Case: Promote .repo files to root
			// This allows https://pkg.uppsync.com/uppsyncd.repo
			if (filePath.endsWith(".repo")) {
				const rootKey = relativePath.split("\\").join("/");
				console.log(`[UPLOAD] ${rootKey} (ROOT COPY)`);
				await s3.send(
					new PutObjectCommand({
						Bucket: BUCKET,
						Key: rootKey,
						Body: fileContent,
						ContentType: mimeType,
						CacheControl: "public, max-age=60, must-revalidate",
					}),
				);
			}
		}

		console.log(`[SUCCESS] Repo upload complete.`);

		// --- Upload Root GPG Key (if exists) ---
		const rootGpgKey = "uppsync-main.gpg";
		try {
			const gpgStats = await stat(rootGpgKey);
			if (gpgStats.isFile()) {
				console.log(`[UPLOAD] ${rootGpgKey} (Root GPG Key)`);
				const fileContent = await readFile(rootGpgKey);
				await s3.send(
					new PutObjectCommand({
						Bucket: BUCKET,
						Key: rootGpgKey, // Upload to root of bucket
						Body: fileContent,
						ContentType: "application/pgp-keys",
						CacheControl: "public, max-age=3600, must-revalidate",
					}),
				);
				console.log(`[SUCCESS] Root GPG Key uploaded.`);
			}
		} catch (_e) {
			console.log(`[INFO]  No root '${rootGpgKey}' found, skipping.`);
		}
	} catch (error) {
		console.error("[ERROR] Upload failed:", error);
		process.exit(1);
	}
}

main();
