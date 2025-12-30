import { spawn, file, write, CryptoHasher } from "bun";

// 1. Get Git Commit Hash
const gitProc = spawn(["git", "rev-parse", "HEAD"], { stdout: "pipe" });
const commit = (await new Response(gitProc.stdout).text()).trim();

// 2. Get Current Date
const date = new Date().toISOString();

// 3. Detect Target
const target = process.env.TARGET;

console.log(`[BUILD] Starting build process...`);
console.log(`        Commit: ${commit}`);
console.log(`        Date:   ${date}`);
console.log(`        Target: ${target || "Auto-detect (Host)"}`);

// 4. Determine Output Filename
const isWindows = target ? target.includes("windows") : process.platform === "win32";
const filename = isWindows ? "uppsyncd.exe" : "uppsyncd";
const outfile = `dist/${filename}`;

// 5. Run Bun Compile
const args = [
    "build",
    "--compile",
    "--minify",
    "--sourcemap=none",
    "src/index.ts",
    "--outfile", outfile,
    "--define", `process.env.GIT_COMMIT="${commit}"`,
    "--define", `process.env.BUILD_DATE="${date}"`
];

if (target) args.push("--target", target);

const buildProc = spawn(["bun", ...args], {
    stdio: ["inherit", "inherit", "inherit"]
});

const exitCode = await buildProc.exited;

if (exitCode !== 0) {
    console.error(`[ERROR] Build failed with exit code ${exitCode}`);
    process.exit(exitCode);
}

// 6. Generate Checksum (SHA256)
console.log(`[HASH]  Generating checksum...`);

try {
    const binaryFile = file(outfile);
    const buffer = await binaryFile.arrayBuffer();

    // Calculate SHA256
    const hasher = new CryptoHasher("sha256");
    hasher.update(buffer);
    const hash = hasher.digest("hex");

    // Write to .sha256 file (Standard format: "HASH  FILENAME")
    const checksumContent = `${hash}  ${filename}\n`;
    await write(`${outfile}.sha256`, checksumContent);

    console.log(`[DONE]  Build successful.`);
    console.log(`        Binary:   ${outfile}`);
    console.log(`        Checksum: ${outfile}.sha256`);

} catch (e) {
    console.error(`[ERROR] Failed to generate checksum:`, e);
    process.exit(1);
}
