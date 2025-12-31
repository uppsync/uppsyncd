import { $, write } from "bun";
import { mkdir, readdir, rename } from "node:fs/promises";
import { join } from "node:path";

// --- CONFIGURATION ---
const REPO_DIR = "repo";
const CONF_DIR = join(REPO_DIR, "conf");
const INPUT_DIR = "dist"; // Where GitHub Actions downloaded the artifacts

// Default to 'stable', but allow override (e.g., 'unstable' for nightly)
const CODENAME = process.env.CODENAME || "stable";

const DISTRIBUTION_CONFIG = `
Origin: uppsyncd
Label: uppsyncd
Codename: ${CODENAME}
Architectures: amd64 arm64
Components: main
Description: Uppsync Monitoring Agent
SignWith: default
`;

async function main() {
    console.log(`[REPO]    Initializing APT Repository generation`);
    console.log(`          Codename: ${CODENAME}`);
    console.log(`          Input:    ${INPUT_DIR}`);

    // 1. Pre-flight Check: Ensure we have packages
    try {
        const files = await readdir(INPUT_DIR);
        const debs = files.filter(f => f.endsWith(".deb"));

        if (debs.length === 0) {
            console.error(`[ERROR] No .deb files found in '${INPUT_DIR}'.`);
            process.exit(1);
        }
        console.log(`[REPO]    Found ${debs.length} packages to index.`);
    } catch (e) {
        console.error(`[ERROR] Directory '${INPUT_DIR}' does not exist.`);
        process.exit(1);
    }

    // 2. Standardize Filenames (Optional but recommended)
    // Converts 'uppsyncd-linux-amd64.deb' -> 'uppsyncd_amd64.deb'
    // This helps reprepro organize files cleanly.
    const files = await readdir(INPUT_DIR);
    for (const f of files) {
        if (!f.endsWith(".deb")) continue;

        let newName = f;

        // Convert CI artifact naming to Debian convention (underscore separator)
        if (f.includes("-linux-amd64")) {
            newName = f.replace("-linux-amd64", "_amd64");
        } else if (f.includes("-linux-arm64")) {
            newName = f.replace("-linux-arm64", "_arm64");
        }

        if (newName !== f) {
            console.log(`[RENAME]  ${f} -> ${newName}`);
            await rename(join(INPUT_DIR, f), join(INPUT_DIR, newName));
        }
    }

    // 3. Prepare Repository Structure
    await mkdir(CONF_DIR, { recursive: true });

    // 4. Write Distributions Config
    await write(join(CONF_DIR, "distributions"), DISTRIBUTION_CONFIG.trim() + "\n");
    console.log(`[CONFIG]  Written to ${join(CONF_DIR, "distributions")}`);

    // 5. Run Reprepro
    // We use 'sh -c' to allow wildcard expansion (*.deb)
    console.log(`[EXEC]    Running reprepro includedeb...`);

    try {
        // Use glob pattern directly in the shell command
        await $`reprepro -V --basedir ${REPO_DIR} includedeb ${CODENAME} ${INPUT_DIR}/*.deb`;
        console.log(`[SUCCESS] Repository generated in '${REPO_DIR}/'`);
    } catch (e: any) {
        console.error(`[ERROR] Reprepro failed with exit code ${e.exitCode}`);
        process.exit(e.exitCode || 1);
    }
}

main();
