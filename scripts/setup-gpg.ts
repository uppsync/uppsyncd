import { $ } from "bun";
import { join } from "node:path";
import { homedir } from "node:os";
import { appendFile } from "node:fs/promises";

const GPG_PRIVATE_KEY = process.env.GPG_PRIVATE_KEY;
const GPG_PASSPHRASE = process.env.GPG_PASSPHRASE;

if (!GPG_PRIVATE_KEY) {
    console.error("::error::GPG_PRIVATE_KEY environment variable is not set.");
    process.exit(1);
}

console.log("[GPG] Importing private key...");
// Import GPG Key
// We use a temporary file or pipe. Bun's $ can pipe strings.
try {
    await $`echo "${GPG_PRIVATE_KEY}" | gpg --batch --import`;
} catch (e) {
    console.error("::error::Failed to import GPG key.");
    process.exit(1);
}

// Configure GPG Agent for non-interactive signing
if (GPG_PASSPHRASE) {
    console.log("[GPG] Configuring GPG Agent for non-interactive signing...");
    const gpgAgentConf = join(homedir(), ".gnupg", "gpg-agent.conf");

    try {
        await appendFile(gpgAgentConf, "\nallow-preset-passphrase\n");
        await $`gpg-connect-agent reloadagent /bye`;

        // Get the keygrip of the imported key
        // gpg --list-secret-keys --with-colons | grep "^grp" | cut -d: -f10 | head -n 1
        const keygripOutput = await $`gpg --list-secret-keys --with-colons`.text();
        const keygrip = keygripOutput
            .split("\n")
            .find(line => line.startsWith("grp:"))
            ?.split(":")[9];

        if (!keygrip) {
            console.error("::error::Unable to find GPG Keygrip.");
            process.exit(1);
        }

        // Find gpg-preset-passphrase
        // Note: In standard Ubuntu runners, it's usually in /usr/lib/gnupg/gpg-preset-passphrase or /usr/libexec/gpg-preset-passphrase
        // We'll try to find it.
        let presetCmdPath = "";
        const possiblePaths = [
            "/usr/lib/gnupg/gpg-preset-passphrase",
            "/usr/libexec/gpg-preset-passphrase",
            "/usr/lib/gpg-preset-passphrase"
        ];

        for (const p of possiblePaths) {
            const exists = await $`test -f ${p}`.exitCode === 0;
            if (exists) {
                presetCmdPath = p;
                break;
            }
        }

        // Fallback to find if not found in common locations
        if (!presetCmdPath) {
             try {
                const findOutput = await $`find /usr/lib /usr/libexec -name gpg-preset-passphrase -print -quit 2>/dev/null`.text();
                presetCmdPath = findOutput.trim();
             } catch (e) {
                 // ignore
             }
        }

        if (presetCmdPath) {
            console.log(`[GPG] Presetting passphrase using ${presetCmdPath}...`);
            await $`echo "${GPG_PASSPHRASE}" | ${presetCmdPath} --preset ${keygrip}`;
        } else {
            console.warn("::warning::gpg-preset-passphrase not found. Signing may fail.");
        }

    } catch (e) {
        console.error("::error::Failed to configure GPG agent.", e);
        process.exit(1);
    }
}

// Export Key ID for subsequent steps
try {
    const keyListOutput = await $`gpg --list-secret-keys --with-colons`.text();
    const keyId = keyListOutput
        .split("\n")
        .find(line => line.startsWith("sec:"))
        ?.split(":")[4];

    if (keyId) {
        console.log(`[GPG] Key ID: ${keyId}`);
        // Write to GITHUB_OUTPUT if running in Actions
        if (process.env.GITHUB_OUTPUT) {
            await appendFile(process.env.GITHUB_OUTPUT, `GPG_KEY_ID=${keyId}\n`);
        }
    } else {
        console.warn("::warning::Could not determine GPG Key ID.");
    }
} catch (e) {
    console.error("::error::Failed to get GPG Key ID.");
}
