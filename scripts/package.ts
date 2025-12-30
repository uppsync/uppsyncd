import { spawn, file } from "bun";
import { mkdir, copyFile, unlink } from "node:fs/promises";

// 1. Configuration
const NFPM_EXPECTED_PATH = "dist/uppsyncd"; // Must match 'src' in nfpm.yaml
const OUTPUT_DIR = "packages";

// 2. Read Environment Variables
const rawVersion = process.env.VERSION || "0.0.0-dev";
const arch = process.env.ARCH || "amd64";
const inputBinary = process.env.OUTFILE || NFPM_EXPECTED_PATH;

// 3. Sanitize Version (Debian requires X.Y.Z, no 'v')
const version = rawVersion.replace(/^v/, "");

console.log(`[PACKAGE] Starting .deb packaging process`);
console.log(`          Version: ${version}`);
console.log(`          Arch:    ${arch}`);
console.log(`          Input:   ${inputBinary}`);

async function main() {
    // 4. Pre-flight Check
    const binaryFile = file(inputBinary);
    if (!(await binaryFile.exists())) {
        console.error(`[ERROR] Input binary not found at: ${inputBinary}`);
        process.exit(1);
    }

    // 5. Standardize Binary Name
    // nfpm.yaml expects "dist/uppsyncd". We copy the specific arch binary to this path.
    if (inputBinary !== NFPM_EXPECTED_PATH) {
        console.log(`[SETUP]   Copying ${inputBinary} -> ${NFPM_EXPECTED_PATH}`);
        await copyFile(inputBinary, NFPM_EXPECTED_PATH);
    }

    // 6. Ensure Output Directory
    await mkdir(OUTPUT_DIR, { recursive: true });

    // 7. Define Output Filename
    const debFile = `${OUTPUT_DIR}/uppsyncd_${version}_${arch}.deb`;

    // 8. Run NFPM
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
            console.log(`[DONE]    Package created successfully.`);
            console.log(`          File: ${debFile}`);
        } else {
            console.error(`[ERROR] NFPM failed with exit code ${exitCode}`);
            process.exit(exitCode);
        }

    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            console.error(`[ERROR] 'nfpm' command not found.`);
            console.error(`        Please install it or run inside the CI environment.`);
        } else {
            console.error(`[ERROR] Unexpected error:`, error);
        }
        process.exit(1);
    } finally {
        // Optional: Cleanup the temporary copy to keep dist/ clean
        if (inputBinary !== NFPM_EXPECTED_PATH) {
            // await unlink(NFPM_EXPECTED_PATH).catch(() => {});
        }
    }
}

main();
