import { spawn } from "bun";
import { basename, dirname } from "node:path";
import { unlink } from "node:fs/promises";

// 1. Get Git Commit Hash
const gitProc = spawn(["git", "rev-parse", "HEAD"], { stdout: "pipe" });
const commit = (await new Response(gitProc.stdout).text()).trim();

// 2. Get Current Date
const date = new Date().toISOString();

// 3. Detect Inputs
const target = process.env.TARGET;
const envOutfile = process.env.OUTFILE;

console.log(`[BUILD] Starting build process`);
console.log(`        Commit: ${commit}`);
console.log(`        Date:   ${date}`);
console.log(`        Target: ${target || "Auto-detect (Host)"}`);

// 4. Determine Output Filename
let outfile: string;
let filename: string;

if (envOutfile) {
    outfile = envOutfile;

    // AUTO-FIX: Append .exe for Windows if missing
    if (target?.includes("windows") && !outfile.endsWith(".exe")) {
        outfile += ".exe";
    }

    filename = basename(outfile);
} else {
    // Local dev fallback
    const isWindows = target ? target.includes("windows") : process.platform === "win32";
    filename = isWindows ? "uppsyncd.exe" : "uppsyncd";
    outfile = `dist/${filename}`;
}

console.log(`        Output: ${outfile}`);

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

// 6. Post-Process: Compress for macOS (.tar.gz)
if (target?.includes("darwin") || filename.includes("darwin")) {
    console.log(`[TAR]   Compressing for macOS...`);

    const tarFile = `${outfile}.tar.gz`;
    const dir = dirname(outfile);
    const rawBinary = basename(outfile);

    const tarProc = spawn([
        "tar",
        "-czf",
        basename(tarFile),
        "-C",
        dir,
        rawBinary
    ], {
        cwd: dir,
        stdio: ["ignore", "inherit", "inherit"]
    });

    const tarExit = await tarProc.exited;
    if (tarExit !== 0) {
        console.error(`[ERROR] Tar compression failed`);
        process.exit(tarExit);
    }

    try {
        await unlink(outfile);
    } catch (e) {
        console.warn(`[WARN]  Could not delete raw binary: ${outfile}`);
    }

    outfile = tarFile;
}

console.log(`[DONE]  Build successful.`);
console.log(`        Artifact: ${outfile}`);
