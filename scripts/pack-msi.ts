import { spawn, file } from "bun";
import { mkdir } from "node:fs/promises";
import { basename } from "node:path";

// 1. Configuration
const WIX_TEMPLATE = "scripts/main.wxs";
const OUTPUT_DIR = "dist";

// 2. Environment Variables
const rawVersion = process.env.VERSION || "0.0.0-dev";
// The workflow passes "dist/uppsyncd-windows-amd64"
let inputBinary = process.env.OUTFILE || "dist/uppsyncd.exe";

// 3. Prepare Version
const cleanVersion = rawVersion.replace(/^v/, "");
const winVersion = /^\d+\.\d+\.\d+$/.test(cleanVersion)
    ? `${cleanVersion}.0`
    : "0.0.0.0";

// 4. Pre-flight Check (Auto-Fix .exe)
// If "dist/uppsyncd" doesn't exist, check "dist/uppsyncd.exe"
const f = file(inputBinary);
if (!(await f.exists())) {
    if (await file(inputBinary + ".exe").exists()) {
        inputBinary += ".exe";
    } else {
        console.error(`[ERROR] Input binary not found: ${inputBinary}`);
        console.error(`        (Also checked ${inputBinary}.exe)`);
        process.exit(1);
    }
}

// 5. Output Filename
// dist/uppsyncd-windows-amd64.exe -> dist/uppsyncd-windows-amd64.msi
const baseName = basename(inputBinary, ".exe");
const msiFile = `${OUTPUT_DIR}/${baseName}.msi`;

console.log(`[PACK-MSI] Starting Windows MSI build`);
console.log(`           Input:    ${inputBinary}`);
console.log(`           Template: ${WIX_TEMPLATE}`);
console.log(`           Version:  ${winVersion}`);
console.log(`           Output:   ${msiFile}`);

async function main() {
    // Ensure template exists
    if (!(await file(WIX_TEMPLATE).exists())) {
        console.error(`[ERROR] WiX template not found at: ${WIX_TEMPLATE}`);
        process.exit(1);
    }

    // Ensure output dir
    await mkdir(OUTPUT_DIR, { recursive: true });

    // Run WiX
    try {
        const proc = spawn([
            "wix", "build",
            "-o", msiFile,
            `-d`, `Version=${winVersion}`,
            `-d`, `BinaryPath=${inputBinary}`,
            WIX_TEMPLATE
        ], {
            stdio: ["inherit", "inherit", "inherit"]
        });

        const exitCode = await proc.exited;

        if (exitCode === 0) {
            console.log(`[SUCCESS] MSI created: ${msiFile}`);
        } else {
            console.error(`[ERROR] WiX failed with code ${exitCode}`);
            process.exit(exitCode);
        }
    } catch (e) {
        console.error(`[ERROR] Execution failed:`, e);
        process.exit(1);
    }
}

main();
