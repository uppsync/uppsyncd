import { spawn, file } from "bun";
import { copyFile, unlink } from "node:fs/promises";
import { basename } from "node:path";

// 1. Configuration
const NFPM_EXPECTED_PATH = "dist/uppsyncd"; // Must match 'src' in nfpm.yaml
const OUTPUT_DIR = "dist";

// 2. Read Environment Variables
const rawVersion = process.env.VERSION || "0.0.0-dev";
const arch = process.env.ARCH || "amd64";
const inputBinary = process.env.OUTFILE || NFPM_EXPECTED_PATH;

// Derive the package name from the binary filename (e.g., uppsyncd-linux-amd64 -> uppsyncd-linux-amd64.deb)
const baseName = basename(inputBinary);
const outputDeb = `${OUTPUT_DIR}/${baseName}.deb`;

// 3. Sanitize Version (Debian requires X.Y.Z, no 'v')
const version = rawVersion.replace(/^v/, "");

console.log(`[PACK] Starting Debian packaging`);
console.log(`       Input:   ${inputBinary}`);
console.log(`       Output:  ${outputDeb}`);
console.log(`       Version: ${version}`);
console.log(`       Arch:    ${arch}`);

async function main() {
    // 4. Pre-flight Check
    const binaryFile = file(inputBinary);
    if (!(await binaryFile.exists())) {
        console.error(`[ERROR] Input binary not found at: ${inputBinary}`);
        process.exit(1);
    }

    // 5. Prepare NFPM source
    // Copy specific binary to generic name 'dist/uppsyncd' so NFPM can find it based on nfpm.yaml
    if (inputBinary !== NFPM_EXPECTED_PATH) {
        await copyFile(inputBinary, NFPM_EXPECTED_PATH);
    }

    try {
        // 6. Run NFPM
        const proc = spawn([
            "nfpm", "pkg",
            "--packager", "deb",
            "--target", outputDeb
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
            console.log(`[SUCCESS] Package created: ${outputDeb}`);
        } else {
            console.error(`[ERROR] NFPM exited with code ${exitCode}`);
            process.exit(exitCode);
        }

    } catch (error) {
        console.error(`[ERROR] Execution failed:`, error);
        process.exit(1);
    } finally {
        // 7. Cleanup
        // Remove the temporary generic file to keep dist/ clean
        if (inputBinary !== NFPM_EXPECTED_PATH) {
            try {
                await unlink(NFPM_EXPECTED_PATH);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
}

main();
