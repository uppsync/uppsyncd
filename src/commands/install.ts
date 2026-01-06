import { writeFileSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { $ } from "bun";

export async function install() {
    const platform = process.platform;
    const execPath = await realpath(process.execPath);
    const isBun = execPath.endsWith("bun") || execPath.endsWith("bun.exe");

    let scriptPath = process.argv[1];
    if (isBun) {
        if (!scriptPath) {
            throw new Error(
                "Could not determine script path (process.argv[1] is undefined)",
            );
        }
        scriptPath = await realpath(scriptPath);
    } else {
        scriptPath = scriptPath ?? "";
    }

    console.log(`Installing uppsyncd service on ${platform}...`);

    try {
        if (platform === "linux") {
            await installLinux(execPath, scriptPath, isBun);
        } else {
            console.error(
                `Unsupported platform: ${platform}. Only Linux is supported.`,
            );
            process.exit(1);
        }
        console.log("uppsyncd service installed successfully.");
        console.log("Run 'uppsyncd start' to start the service.");
    } catch (error) {
        console.error("Failed to install service:", error);
        process.exit(1);
    }
}

async function installLinux(
    execPath: string,
    scriptPath: string,
    isBun: boolean,
) {
    const command = isBun ? `"${execPath}" "${scriptPath}"` : `"${execPath}"`;

    const serviceContent = `[Unit]
Description=Uppsync Daemon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${command} run --metrics
Restart=always
RestartSec=5
StateDirectory=uppsyncd
StateDirectoryMode=0700

[Install]
WantedBy=multi-user.target
`;
    const servicePath = "/etc/systemd/system/uppsyncd.service";

    try {
        writeFileSync(servicePath, serviceContent);
    } catch (e) {
        if ((e as { code?: string }).code === "EACCES") {
            console.error("Permission denied. Please run as root/sudo.");
            process.exit(1);
        }
        throw e;
    }

    await $`systemctl daemon-reload`;
    await $`systemctl enable uppsyncd`;
}
