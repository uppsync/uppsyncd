import { $, file } from "bun";
import { mkdir, unlink } from "node:fs/promises";
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
const baseName = basename(inputBinary, ".exe");
const msiFile = `${OUTPUT_DIR}/${baseName}.msi`;
const pdbFile = `${OUTPUT_DIR}/${baseName}.wixpdb`;

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
        await $`wix build -o ${msiFile} -d Version=${winVersion} -d BinaryPath=${inputBinary} ${WIX_TEMPLATE}`;

        console.log(`[SUCCESS] MSI created: ${msiFile}`);

        // Cleanup the debug file (.wixpdb)
        try {
            await unlink(pdbFile);
            console.log(`[CLEAN]   Removed debug symbols: ${pdbFile}`);
        } catch (e) {
            // Ignore if file doesn't exist
        }

    } catch (e: any) {
        console.error(`[ERROR] WiX failed with code ${e.exitCode}`);
        process.exit(e.exitCode || 1);
    }
}

main();
