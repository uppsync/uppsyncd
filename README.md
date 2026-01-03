# uppsyncd
🦅 The official, open-source monitoring agent for Uppsync. A lightweight binary that collects system metrics (CPU/RAM) and acts as a Private Probe for internal uptime checks.

## Installation

<details>
<summary>Linux (Debian/Ubuntu)</summary>

1. **Install prerequisites:**
   ```bash
   sudo apt-get update
   sudo apt-get install -y curl
   ```

2. **Add the GPG key:**
   ```bash
   sudo mkdir -p -m 0755 /etc/apt/keyrings
   curl -fsSL https://pkg.uppsync.com/uppsync.gpg | sudo tee /etc/apt/keyrings/uppsync.gpg > /dev/null
   ```

3. **Add the repository:**
   ```bash
   echo "deb [signed-by=/etc/apt/keyrings/uppsync.gpg] https://pkg.uppsync.com/uppsyncd stable main" \
   | sudo tee /etc/apt/sources.list.d/uppsyncd.list
   ```

4. **Install the agent:**
   ```bash
   sudo apt-get update
   sudo apt-get install uppsyncd
   ```

</details>

<details>
<summary>Linux (Red Hat / CentOS / Fedora / Amazon Linux)</summary>

1. **Add the repository:**
   ```bash
   curl -fsSL https://pkg.uppsync.com/uppsyncd/uppsyncd.repo | sudo tee /etc/yum.repos.d/uppsyncd.repo
   ```

2. **Install the agent:**
   ```bash
   sudo dnf install uppsyncd
   ```

</details>

<details>
<summary>Linux (Alpine)</summary>

1. **Add the signing key:**
   ```bash
   curl -fsSL https://pkg.uppsync.com/uppsync.rsa.pub -o /etc/apk/keys/uppsync.rsa.pub
   ```

2. **Add the repository:**
   ```bash
   echo "https://pkg.uppsync.com/uppsyncd/alpine/stable" >> /etc/apk/repositories
   ```

3. **Install the agent:**
   ```bash
   apk update
   apk add uppsyncd
   ```

</details>

<details>
<summary>Linux (Manual / Direct Download)</summary>

Alternatively, download the latest release directly:

| Type | amd64 / x86-64 | ARM64 / aarch64 |
| :--- | :--- | :--- |
| Binary | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-amd64) | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-arm64) |
| .deb | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-amd64.deb) | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-arm64.deb) |
| .rpm | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-x86_64.rpm) | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-aarch64.rpm) |

</details>

<details>
<summary>macOS</summary>

1. **Download the installer:**
   - [Apple Silicon](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-arm64.pkg)
   - [Intel](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-amd64.pkg)

2. **Install:**
   Double-click the downloaded `.pkg` file and follow the prompts.

Alternatively, download the latest [Darwin arm64 release ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-darwin-arm64.tar.gz) or latest [Darwin amd64 release ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-darwin-amd64.tar.gz) directly.

</details>

<details>
<summary>Windows</summary>

1. **Download the installer:**
   [Download MSI](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-windows-amd64.msi)

2. **Install:**
   Double-click the downloaded `.msi` file and follow the prompts.

Alternatively, download the latest [Windows amd64 executable ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-windows-amd64.exe) directly.

</details>

<details>
<summary>Docker</summary>

Run the latest version from Docker Hub:

```bash
docker run -d --name uppsyncd uppsync/uppsyncd:latest
```

Or from GitHub Container Registry:

```bash
docker run -d --name uppsyncd ghcr.io/uppsync/uppsyncd:latest
```

</details>
