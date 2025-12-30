import { spawn, file } from "bun";
import { copyFile } from "node:fs/promises";

// Configuration
const NFPM_EXPECTED_PATH = "dist/uppsyncd";
const OUTPUT_DIR = "dist";

// Environment Variables
const rawVersion = process.env.VERSION || "0.0.0-dev";
const arch = process.env.ARCH || "amd64";
const inputBinary = process.env.OUTFILE || NFPM_EXPECTED_PATH;
const assetName = process.env.ASSET_NAME || `uppsyncd-linux-${arch}`;

// Sanitize Version (Debian standards require X.Y.Z, no 'v' prefix)
const version = rawVersion.replace(/^v/, "");

console.log(`[PACK] Starting Debian packaging`);
console.log(`       Input:   ${inputBinary}`);
console.log(`       Version: ${version}`);
console.log(`       Arch:    ${arch}`);
console.log(`       Output:  ${assetName}.deb`);

async function main() {
    // 1. Pre-flight Check
    const binaryFile = file(inputBinary);
    if (!(await binaryFile.exists())) {
        console.error(`[ERROR] Input binary not found: ${inputBinary}`);
        process.exit(1);
    }

    // 2. Prepare NFPM source
    // NFPM expects the binary at the specific path defined in nfpm.yaml
    if (inputBinary !== NFPM_EXPECTED_PATH) {
        await copyFile(inputBinary, NFPM_EXPECTED_PATH);
    }

    // 3. Define Output File
    const debFile = `${OUTPUT_DIR}/${assetName}.deb`;

    // 4. Run NFPM
    try {
        const proc = spawn([
            "nfpm", "pkg",
            "--packager", "deb",
            "--target", debFile
        ], {
            stdio: ["inherit", "inherit", "inherit"],
            env: {
                ...process.env,
                VERSION: version,
                ARCH: arch
            }
        });

        const exitCode = await proc.exited;

        if (exitCode === 0) {
            console.log(`[SUCCESS] Package created: ${debFile}`);
        } else {
            console.error(`[ERROR] NFPM exited with code ${exitCode}`);
            process.exit(exitCode);
        }

    } catch (error) {
        console.error(`[ERROR] Execution failed:`, error);
        process.exit(1);
    }
}

main();
