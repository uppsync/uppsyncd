import { $ } from "bun";
import { basename, dirname } from "node:path";
import { unlink, readFile } from "node:fs/promises";

// 1. Get Git Commit Hash
const commit = (await $`git rev-parse HEAD`.text()).trim();

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
    // Auto-Fix: Append .exe for Windows if missing
    if (target?.includes("windows") && !outfile.endsWith(".exe")) {
        outfile += ".exe";
    }
    filename = basename(outfile);
} else {
    // Local dev fallback: Read from package.json
    try {
        const pkg = JSON.parse(await readFile("package.json", "utf-8"));
        const binPath = Object.values(pkg.bin)[0] as string;

        if (!binPath) throw new Error("No bin entry found");

        const isWindows = target ? target.includes("windows") : process.platform === "win32";
        outfile = binPath;

        if (isWindows && !outfile.endsWith(".exe")) {
            outfile += ".exe";
        }
        filename = basename(outfile);
    } catch (e) {
        console.error(`[ERROR] Failed to determine output path from package.json`);
        console.error(e);
        process.exit(1);
    }
}

console.log(`        Output: ${outfile}`);

// 5. Run Bun Compile
try {
    await $`bun build --compile --minify --sourcemap=none src/index.ts --outfile ${outfile} --define process.env.GIT_COMMIT="${commit}" --define process.env.BUILD_DATE="${date}" ${target ? ["--target", target] : []}`;
} catch (e: any) {
    console.error(`[ERROR] Build failed with exit code ${e.exitCode}`);
    process.exit(e.exitCode || 1);
}

// 6. Post-Process: Compress for macOS (.tar.gz)
if (target?.includes("darwin") || filename.includes("darwin")) {
    console.log(`[TAR]   Compressing for macOS...`);

    const tarFile = `${outfile}.tar.gz`;
    const dir = dirname(outfile);
    const rawBinary = basename(outfile);

    try {
        await $`tar -czf ${basename(tarFile)} ${rawBinary}`.cwd(dir);
    } catch (e: any) {
        console.error(`[ERROR] Tar compression failed`);
        process.exit(e.exitCode || 1);
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
