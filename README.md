# uppsyncd
🦅 The official, open-source monitoring agent for Uppsync. A lightweight binary that collects system metrics (CPU/RAM) and acts as a Private Probe for internal uptime checks.

## Installation

### Linux (Debian/Ubuntu)

1. **Install prerequisites:**
   ```bash
   sudo apt-get update
   sudo apt-get install -y curl gpg
   ```

2. **Add the GPG key:**
   ```bash
   sudo mkdir -p -m 0755 /etc/apt/keyrings
   curl -fsSL https://pkg.uppsync.com/uppsync-main.gpg | sudo tee /etc/apt/keyrings/uppsync-main.gpg > /dev/null
   ```

3. **Add the repository:**
   ```bash
   # For stable releases
   echo "deb [signed-by=/etc/apt/keyrings/uppsync-main.gpg] https://pkg.uppsync.com/uppsyncd stable main" \
   | sudo tee /etc/apt/sources.list.d/uppsyncd.list

   # OR for nightly / dev
   echo "deb [signed-by=/etc/apt/keyrings/uppsync-main.gpg] https://pkg.uppsync.com/uppsyncd unstable main" \
   | sudo tee /etc/apt/sources.list.d/uppsyncd.list
   ```

4. **Install the agent:**
   ```bash
   sudo apt-get update
   sudo apt-get install uppsyncd
   ```

5. **Verify installation:**
   ```bash
   sudo systemctl status uppsyncd
   ```

### Linux (Red Hat / CentOS / Fedora / Amazon Linux)

1. **Add the repository:**
   ```bash
   curl -fsSL https://pkg.uppsync.com/uppsyncd.repo | sudo tee /etc/yum.repos.d/uppsyncd.repo
   ```

2. **Install the agent:**
   ```bash
   # (Optional) Enable unstable builds
   # sudo dnf config-manager --set-enabled uppsyncd-unstable
   # OR for older systems:
   # sudo yum-config-manager --enable uppsyncd-unstable

   sudo dnf install uppsyncd
   # OR for older systems
   sudo yum install uppsyncd
   ```

3. **Verify installation:**
   ```bash
   sudo systemctl status uppsyncd
   ```

### Linux (Manual / Direct Download)

Alternatively, download the latest release directly:

| Type | amd64 / x86-64 | ARM64 / aarch64 |
| :--- | :--- | :--- |
| **Binary** | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-amd64) | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-arm64) |
| **.deb** | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-amd64.deb) | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-arm64.deb) |
| **.rpm** | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-x86_64.rpm) | [Download ↗](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-linux-aarch64.rpm) |

### Windows

1. **Download the installer:**
   [Download MSI](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-windows-amd64.msi)

2. **Install:**
   Double-click the downloaded `.msi` file and follow the prompts.

3. **Verify installation:**
   ```cmd
   sc query uppsyncd
   ```

### macOS

1. **Download the installer:**
   - [Apple Silicon](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-arm64.pkg)
   - [Intel](https://github.com/uppsync/uppsyncd/releases/latest/download/uppsyncd-amd64.pkg)

2. **Install:**
   Double-click the downloaded `.pkg` file and follow the prompts.

3. **Verify installation:**
   ```bash
   sudo launchctl list | grep uppsyncd
   ```
