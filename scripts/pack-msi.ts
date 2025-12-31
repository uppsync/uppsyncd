import { spawn, file } from "bun";
import { mkdir } from "node:fs/promises";
import { basename } from "node:path";

// 1. Configuration
// CHANGED: Pointing to the file inside scripts/
const WIX_TEMPLATE = "scripts/main.wxs";
const OUTPUT_DIR = "dist";

// 2. Environment Variables
const rawVersion = process.env.VERSION || "0.0.0-dev";
const inputBinary = process.env.OUTFILE || "dist/uppsyncd.exe";

// 3. Prepare Version
const cleanVersion = rawVersion.replace(/^v/, "");
const winVersion = /^\d+\.\d+\.\d+$/.test(cleanVersion)
    ? `${cleanVersion}.0`
    : "0.0.0.0";

// 4. Output Filename
const baseName = basename(inputBinary, ".exe");
const msiFile = `${OUTPUT_DIR}/${baseName}.msi`;

console.log(`[PACK-MSI] Starting Windows MSI build`);
console.log(`           Input:    ${inputBinary}`);
console.log(`           Template: ${WIX_TEMPLATE}`);
console.log(`           Version:  ${winVersion}`);
console.log(`           Output:   ${msiFile}`);

async function main() {
    // Pre-flight check
    if (!(await file(inputBinary).exists())) {
        console.error(`[ERROR] Input binary not found: ${inputBinary}`);
        process.exit(1);
    }

    // Ensure template exists (Safety check)
    if (!(await file(WIX_TEMPLATE).exists())) {
        console.error(`[ERROR] WiX template not found at: ${WIX_TEMPLATE}`);
        process.exit(1);
    }

    // Ensure output dir
    await mkdir(OUTPUT_DIR, { recursive: true });

    // Run WiX (wix build)
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
