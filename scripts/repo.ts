import { spawn, write } from "bun";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

const REPO_DIR = "repo";
const CONF_DIR = join(REPO_DIR, "conf");
const PKG_DIR = "packages";

// 1. Define Repository Configuration
// This maps to the 'Release' file that apt-get downloads.
const DISTRIBUTION_CONFIG = `
Origin: uppsyncd
Label: uppsyncd
Codename: stable
Architectures: amd64 arm64
Components: main
Description: apt repository for uppsyncd
SignWith: default
`;

async function main() {
    console.log(`[REPO] Initializing APT Repository generation...`);

    // 2. Pre-flight Check: Are there packages?
    try {
        const files = await readdir(PKG_DIR);
        const debs = files.filter(f => f.endsWith(".deb"));

        if (debs.length === 0) {
            console.error(`[ERROR] No .deb files found in '${PKG_DIR}'. Did build step fail?`);
            process.exit(1);
        }
        console.log(`[REPO] Found ${debs.length} packages to index.`);
    } catch (e) {
        console.error(`[ERROR] Directory '${PKG_DIR}' does not exist.`);
        process.exit(1);
    }

    // 3. Prepare Directory Structure
    await mkdir(CONF_DIR, { recursive: true });

    // 4. Write Configuration
    await write(join(CONF_DIR, "distributions"), DISTRIBUTION_CONFIG.trim());
    console.log(`[REPO] Config written to ${CONF_DIR}/distributions`);

    // 5. Run Reprepro (The Heavy Lifter)
    // -V: Verbose
    // -b: Base directory
    // includedeb: The command to ingest a .deb file
    console.log(`[REPO] Running reprepro...`);

    const proc = spawn([
        "sh", "-c",
        `reprepro -V --basedir ${REPO_DIR} includedeb stable ${PKG_DIR}/*.deb`
    ], {
        stdio: ["inherit", "inherit", "inherit"]
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
        console.error(`[ERROR] Reprepro failed with exit code ${exitCode}`);
        process.exit(exitCode);
    }

    console.log(`[SUCCESS] Repository generated in '${REPO_DIR}/'.`);
    console.log(`          Ready to upload to R2.`);
}

main();
