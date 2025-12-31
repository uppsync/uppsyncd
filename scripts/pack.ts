import { spawn, file } from "bun";
import { copyFile, unlink } from "node:fs/promises";

// 1. Configuration
const NFPM_EXPECTED_PATH = "dist/uppsyncd";
const OUTPUT_DIR = "dist";
const FORMATS = ["deb", "rpm"];

// 2. Read Environment Variables
const rawVersion = process.env.VERSION || "0.0.0-dev";
// This is the "Debian/Standard" arch passed from GitHub Matrix (amd64, arm64)
const inputArch = process.env.ARCH || "amd64";
const inputBinary = process.env.OUTFILE || NFPM_EXPECTED_PATH;
const assetName = process.env.ASSET_NAME || `uppsyncd-linux-${inputArch}`;

// 3. Sanitize Version
const version = rawVersion.replace(/^v/, "");

console.log(`[PACK] Starting packaging process`);
console.log(`       Input:   ${inputBinary}`);
console.log(`       Version: ${version}`);
console.log(`       Arch:    ${inputArch}`);

async function main() {
    // 4. Pre-flight Check
    const binaryFile = file(inputBinary);
    if (!(await binaryFile.exists())) {
        console.error(`[ERROR] Input binary not found: ${inputBinary}`);
        process.exit(1);
    }

    // 5. Standardize Binary Name
    if (inputBinary !== NFPM_EXPECTED_PATH) {
        await copyFile(inputBinary, NFPM_EXPECTED_PATH);
    }

    // 6. Loop through formats
    for (const fmt of FORMATS) {

        // --- ARCHITECTURE TRANSLATION LOGIC ---
        let outputArch = inputArch;

        // RPM uses x86_64 and aarch64
        if (fmt === "rpm") {
            if (inputArch === "amd64") outputArch = "x86_64";
            if (inputArch === "arm64") outputArch = "aarch64";
        }

        // Define Output Filename: uppsyncd-linux-amd64.deb OR uppsyncd-linux-x86_64.rpm
        // We replace the arch in the asset name to match the package standard
        const pkgName = assetName.replace(inputArch, outputArch);
        const pkgFile = `${OUTPUT_DIR}/${pkgName}.${fmt}`;

        console.log(`[NFPM] Generating ${fmt} (${outputArch})...`);

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
                    // Pass the translated arch to NFPM so the internal metadata is correct
                    ARCH: outputArch
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

    // 7. Cleanup
    if (inputBinary !== NFPM_EXPECTED_PATH) {
        try { await unlink(NFPM_EXPECTED_PATH); } catch (e) {}
    }
}

main();
