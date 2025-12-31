import { $, file } from "bun";
import { mkdir, rm, copyFile } from "node:fs/promises";
import { basename, join } from "node:path";

// 1. Configuration
const OUTPUT_DIR = "dist";
const PKG_IDENTIFIER = "com.uppsync.uppsyncd";
const INSTALL_LOCATION = "/usr/local/bin"; // Standard for CLI tools on macOS

// 2. Read Environment Variables
const rawVersion = process.env.VERSION || "0.0.0-dev";
// workflow passes: dist/uppsyncd-darwin-amd64
const inputPath = process.env.OUTFILE || "dist/uppsyncd";

// 3. Sanitize Version
const version = rawVersion.replace(/^v/, "");

console.log(`[PACK-PKG] Starting macOS Installer build`);
console.log(`           Input:    ${inputPath}`);
console.log(`           Version:  ${version}`);

async function main() {
    // 4. Locate the Binary (Handle .tar.gz logic)
    let binaryToPackage = inputPath;
    let isTarball = false;

    // Check if raw binary exists
    if (!(await file(inputPath).exists())) {
        // Check if tarball exists (created by build.ts)
        const tarPath = `${inputPath}.tar.gz`;
        if (await file(tarPath).exists()) {
            console.log(`[EXTRACT]  Found ${tarPath}, extracting binary...`);

            try {
                await $`tar -xzf ${basename(tarPath)}`.cwd(OUTPUT_DIR);
            } catch (e) {
                console.error(`[ERROR] Failed to extract tarball`);
                process.exit(1);
            }
            isTarball = true;
        } else {
            console.error(`[ERROR] Input binary not found: ${inputPath}`);
            process.exit(1);
        }
    }

    // 5. Prepare Staging Directory
    // pkgbuild requires a folder structure that mirrors the installation
    const stageDir = join(OUTPUT_DIR, "_pkg_staging");
    const binDir = join(stageDir, INSTALL_LOCATION.replace(/^\//, ""));

    // Clean previous runs
    await rm(stageDir, { recursive: true, force: true });
    await mkdir(binDir, { recursive: true });

    // Copy binary to staging (Rename to 'uppsyncd')
    await copyFile(binaryToPackage, join(binDir, "uppsyncd"));

    // 6. Define Output Filename
    // dist/uppsyncd-darwin-amd64.pkg -> dist/uppsyncd-amd64.pkg
    const pkgName = basename(inputPath).replace("-darwin", "") + ".pkg";
    const pkgFile = join(OUTPUT_DIR, pkgName);

    // 7. Run pkgbuild
    try {
        console.log(`[PKG]      Building ${pkgFile}...`);

        await $`pkgbuild --root ${stageDir} --identifier ${PKG_IDENTIFIER} --version ${version} --install-location / ${pkgFile}`;

        console.log(`[SUCCESS]  Package created: ${pkgFile}`);
    } catch (e: any) {
        console.error(`[ERROR] pkgbuild failed with code ${e.exitCode}`);
        process.exit(e.exitCode || 1);
    } finally {
        // 8. Cleanup
        await rm(stageDir, { recursive: true, force: true });

        // If we extracted it from tar, remove the raw binary again to keep dist clean
        if (isTarball) {
            await rm(inputPath, { force: true });
        }
    }
}

main();
