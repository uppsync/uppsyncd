import { $, file } from "bun";
import { copyFile, unlink } from "node:fs/promises";

// 1. Configuration
const NFPM_EXPECTED_PATH = "dist/uppsyncd";
const OUTPUT_DIR = "dist";
const FORMATS = ["deb", "rpm"];

// 2. Read Environment Variables
const rawVersion = process.env.VERSION || "0.0.0-dev";
// The input architecture is expected to be Debian-style (amd64, arm64)
const inputArch = process.env.ARCH || "amd64";
const inputBinary = process.env.OUTFILE || NFPM_EXPECTED_PATH;

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
    // NFPM expects the binary at the specific path defined in nfpm.yaml
    if (inputBinary !== NFPM_EXPECTED_PATH) {
        await copyFile(inputBinary, NFPM_EXPECTED_PATH);
    }

    // 6. Loop through formats
    for (const fmt of FORMATS) {

        // --- ARCHITECTURE TRANSLATION LOGIC ---
        // Debian uses amd64/arm64. RPM uses x86_64/aarch64.
        let outputArch = inputArch;

        if (fmt === "rpm") {
            if (inputArch === "amd64") outputArch = "x86_64";
            if (inputArch === "arm64") outputArch = "aarch64";
        }

        // Define Output Filename: uppsyncd-linux-{arch}.{ext}
        // Example: uppsyncd-linux-amd64.deb or uppsyncd-linux-x86_64.rpm
        const pkgName = `uppsyncd-linux-${outputArch}`;
        const pkgFile = `${OUTPUT_DIR}/${pkgName}.${fmt}`;

        console.log(`[NFPM] Generating ${fmt} (${outputArch})...`);

        try {
            await $`nfpm pkg --packager ${fmt} --target ${pkgFile}`.env({
                ...process.env,
                VERSION: version,
                ARCH: outputArch
            });

            console.log(`[DONE]    Created: ${pkgFile}`);

        } catch (error) {
            console.error(`[ERROR] NFPM failed for ${fmt}`);
            console.error(error);
            process.exit(1);
        }
    }

    // 7. Cleanup
    // Remove the temporary generic file to keep dist/ clean
    if (inputBinary !== NFPM_EXPECTED_PATH) {
        try { await unlink(NFPM_EXPECTED_PATH); } catch (e) { }
    }
}

main();
