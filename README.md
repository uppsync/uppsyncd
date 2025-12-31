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
   sudo mkdir -p /etc/apt/keyrings
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
