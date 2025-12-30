import { spawn, file } from "bun";
import { copyFile, unlink } from "node:fs/promises";

// 1. Configuration
const NFPM_EXPECTED_PATH = "dist/uppsyncd";
const OUTPUT_DIR = "dist";
const FORMATS = ["deb", "rpm"];

// 2. Read Environment Variables
const rawVersion = process.env.VERSION || "0.0.0-dev";
const arch = process.env.ARCH || "amd64";
const inputBinary = process.env.OUTFILE || NFPM_EXPECTED_PATH;
const assetName = process.env.ASSET_NAME || `uppsyncd-linux-${arch}`;

const version = rawVersion.replace(/^v/, "");

console.log(`[PACK] Starting packaging process`);
console.log(`       Input:   ${inputBinary}`);
console.log(`       Version: ${version}`);
console.log(`       Arch:    ${arch}`);

async function main() {
    // 3. Pre-flight Check
    const binaryFile = file(inputBinary);
    if (!(await binaryFile.exists())) {
        console.error(`[ERROR] Input binary not found: ${inputBinary}`);
        process.exit(1);
    }

    // 4. Standardize Binary Name
    if (inputBinary !== NFPM_EXPECTED_PATH) {
        await copyFile(inputBinary, NFPM_EXPECTED_PATH);
    }

    // 5. Loop through formats (DEB and RPM)
    for (const fmt of FORMATS) {
        // Define Output Filename: uppsyncd-linux-amd64.rpm
        const pkgFile = `${OUTPUT_DIR}/${assetName}.${fmt}`;

        console.log(`[NFPM] Generaring ${fmt}...`);

        try {
            const proc = spawn([
                "nfpm", "pkg",
                "--packager", fmt,
                "--target", pkgFile
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
                console.log(`[DONE]    Created: ${pkgFile}`);
            } else {
                console.error(`[ERROR] NFPM failed for ${fmt} (Exit code: ${exitCode})`);
                process.exit(exitCode);
            }

        } catch (error) {
            console.error(`[ERROR] Execution failed:`, error);
            process.exit(1);
        }
    }

    // 6. Cleanup
    if (inputBinary !== NFPM_EXPECTED_PATH) {
        try { await unlink(NFPM_EXPECTED_PATH); } catch (e) {}
    }
}

main();
