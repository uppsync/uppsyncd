import { spawn, file } from "bun";
import { mkdir } from "node:fs/promises";

// 1. Configuration & Environment
const BINARY_PATH = "dist/uppsyncd";
const OUTPUT_DIR = "packages";

// Defaults for local testing. In CI, these are passed via Env Vars.
const rawVersion = process.env.VERSION || "0.0.0-dev";
const arch = process.env.ARCH || "amd64"; // 'amd64' or 'arm64'

// 2. Sanitize Version (Debian requires X.Y.Z, no 'v')
const version = rawVersion.replace(/^v/, "");

console.log(`[PACKAGE] Starting .deb packaging...`);
console.log(`          Version: ${version}`);
console.log(`          Arch:    ${arch}`);

// 3. Pre-flight Check: Does the binary exist?
const binaryFile = file(BINARY_PATH);
if (!(await binaryFile.exists())) {
    console.error(`[ERROR] Binary not found at: ${BINARY_PATH}`);
    console.error(`        Please run 'bun run build' first.`);
    process.exit(1);
}

// 4. Ensure Output Directory Exists
await mkdir(OUTPUT_DIR, { recursive: true });

// 5. Define Output Filename
// Standard Debian Format: name_version_arch.deb
const debFile = `${OUTPUT_DIR}/uppsyncd_${version}_${arch}.deb`;

// 6. Run NFPM
// We use 'inherit' to pipe NFPM's internal logs to the console
try {
    const proc = spawn([
        "nfpm", "pkg",
        "--packager", "deb",
        "--target", debFile
    ], {
        stdio: ["inherit", "inherit", "inherit"],
        env: {
            ...process.env,
            // These variables are injected into nfpm.yaml (${VERSION}, ${ARCH})
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
}
