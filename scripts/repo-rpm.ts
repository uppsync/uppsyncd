import { mkdir, readdir, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $, write } from "bun";

const DIST_DIR = "dist";
const CHANNEL = process.env.CHANNEL || "unstable";
const REPO_NAME = process.env.REPO_NAME || "uppsyncd";
const REPO_ROOT = "repo";
const RPM_ROOT = join(REPO_ROOT, "rpm");
const TARGET_DIR = join(RPM_ROOT, CHANNEL);

console.log(`[RPM] Building repository for channel: '${CHANNEL}'`);

// 1. Validate Source
if (!existsSync(DIST_DIR)) {
    console.error(`[RPM] Error: '${DIST_DIR}' directory not found.`);
    process.exit(1);
}

// 2. Create Target Directory (e.g., repo/rpm/stable)
await mkdir(TARGET_DIR, { recursive: true });

// 3. Move RPM files
const files = await readdir(DIST_DIR);
const rpmFiles = files.filter(f => f.endsWith(".rpm"));

if (rpmFiles.length === 0) {
    console.error(`[RPM] Error: No .rpm files found in '${DIST_DIR}'.`);
    process.exit(1);
}

// --- GPG SIGNING ---
const GPG_KEY_ID = process.env.GPG_KEY_ID;
if (GPG_KEY_ID) {
    console.log(`[RPM] Signing packages with Key ID: ${GPG_KEY_ID}`);

    // Import public key into RPM database (required for signing context)
    await $`gpg --export -a > public.key`;
    await $`rpm --import public.key`;
    await $`rm public.key`;

    const rpmMacro = `%_signature gpg
%_gpg_path ${process.env.HOME}/.gnupg
%_gpg_name ${GPG_KEY_ID}
%_gpgbin /usr/bin/gpg
`;
    await write(`${process.env.HOME}/.rpmmacros`, rpmMacro);

    for (const file of rpmFiles) {
        const filePath = join(DIST_DIR, file);
        console.log(`[RPM] Signing ${file}...`);
        await $`rpm --addsign ${filePath}`;
    }
}
// -------------------

for (const file of rpmFiles) {
    const src = join(DIST_DIR, file);
    const dest = join(TARGET_DIR, file);
    console.log(`[RPM] Moving ${file} -> ${dest}`);
    await rename(src, dest);
}

// 4. Generate Metadata
console.log(`[RPM] Running createrepo_c on '${TARGET_DIR}'...`);
try {
    await $`createrepo_c ${TARGET_DIR}`;
    console.log("[RPM] Repository index created successfully.");

    // --- GPG SIGNING (Metadata) ---
    if (GPG_KEY_ID) {
        console.log(`[RPM] Signing repository metadata (repomd.xml)...`);
        const repodataDir = join(TARGET_DIR, "repodata");
        const repomd = join(repodataDir, "repomd.xml");
        const repomdAsc = join(repodataDir, "repomd.xml.asc");

        // Sign the metadata file
        await $`gpg --batch --yes --detach-sign --armor --local-user ${GPG_KEY_ID} --output ${repomdAsc} ${repomd}`;
    }
    // ------------------------------

} catch (err) {
    console.error(`[RPM] Failed to run createrepo_c or gpg signing.`);
    console.error(err);
    process.exit(1);
}

// 5. Generate .repo file for easy installation
// Result: https://pkg.uppsync.com/uppsyncd/uppsyncd.repo
const repoFileName = `${REPO_NAME}.repo`;
const repoFilePath = join(REPO_ROOT, repoFileName);

// If we have a key, we enforce checks. If not, we disable them.
const checkStatus = GPG_KEY_ID ? "1" : "0";

const repoContent = `[${REPO_NAME}]
name=Uppsync Monitoring Agent
baseurl=https://pkg.uppsync.com/${REPO_NAME}/rpm/stable
enabled=1
gpgcheck=${checkStatus}
repo_gpgcheck=${checkStatus}
gpgkey=https://pkg.uppsync.com/${REPO_NAME}-main.gpg

[${REPO_NAME}-unstable]
name=Uppsync Monitoring Agent (Unstable)
baseurl=https://pkg.uppsync.com/${REPO_NAME}/rpm/unstable
enabled=0
gpgcheck=${checkStatus}
repo_gpgcheck=${checkStatus}
gpgkey=https://pkg.uppsync.com/${REPO_NAME}-main.gpg
`;

console.log(`[RPM] Generating repo file at '${repoFilePath}'`);
await write(repoFilePath, repoContent);
