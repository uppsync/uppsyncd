#!/bin/sh
set -e

# Uppsync Universal Installer

REPO_URL="https://pkg.uppsync.com/uppsyncd"
GPG_KEY_URL="https://pkg.uppsync.com/uppsync.gpg"
RSA_KEY_URL="https://pkg.uppsync.com/uppsync.rsa.pub"
BINARY_URL_BASE="https://github.com/uppsync/uppsyncd/releases/latest/download"
CHANNEL="stable"

# Parse arguments
while [ "$#" -gt 0 ]; do
    case "$1" in
        --channel=*)
            CHANNEL="${1#*=}"
            ;;
        --channel)
            CHANNEL="$2"
            shift
            ;;
        stable|unstable)
            CHANNEL="$1"
            ;;
        *)
            echo "Unknown argument: $1"
            exit 1
            ;;
    esac
    shift
done

if [ "$CHANNEL" != "stable" ] && [ "$CHANNEL" != "unstable" ]; then
    echo "Invalid channel: $CHANNEL. Must be 'stable' or 'unstable'."
    exit 1
fi

# Determine if sudo is needed
if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
else
    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        echo "Error: This script requires root privileges. Please run as root or install sudo."
        exit 1
    fi
fi

has_command() {
    command -v "$1" > /dev/null 2>&1
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        OS="unknown"
    fi
}

detect_arch() {
    ARCH=$(uname -m)
    case $ARCH in
        x86_64) ARCH="amd64" ;;
        aarch64) ARCH="arm64" ;;
        *)
            echo "Unsupported architecture: $ARCH"
            exit 1
            ;;
    esac
}

install_curl() {
    if ! has_command curl; then
        echo "Installing curl..."
        if has_command apt-get; then
            $SUDO apt-get update && $SUDO apt-get install -y curl
        elif has_command dnf; then
            $SUDO dnf install -y curl
        elif has_command yum; then
            $SUDO yum install -y curl
        elif has_command apk; then
            $SUDO apk add curl
        elif has_command pacman; then
            $SUDO pacman -Sy --noconfirm curl
        else
            echo "curl is required but could not be installed. Please install curl manually."
            exit 1
        fi
    fi
}

install_apt() {
    echo "Detected APT package manager."
    install_curl

    echo "Adding GPG key..."
    $SUDO mkdir -p /etc/apt/keyrings
    curl -fsSL "$GPG_KEY_URL" | $SUDO tee /etc/apt/keyrings/uppsync.gpg > /dev/null

    echo "Adding repository..."
    echo "deb [signed-by=/etc/apt/keyrings/uppsync.gpg] $REPO_URL $CHANNEL main" | $SUDO tee /etc/apt/sources.list.d/uppsyncd.list

    echo "Installing uppsyncd..."
    $SUDO apt-get update
    $SUDO apt-get install -y uppsyncd
}

install_rpm() {
    echo "Detected RPM package manager."
    install_curl

    echo "Adding repository..."
    curl -fsSL "$REPO_URL/uppsyncd.repo" | $SUDO tee /etc/yum.repos.d/uppsyncd.repo

    echo "Installing uppsyncd..."
    if [ "$CHANNEL" = "unstable" ]; then
        if has_command dnf; then
            $SUDO dnf install -y --disablerepo=uppsyncd --enablerepo=uppsyncd-unstable uppsyncd
        else
            $SUDO yum install -y --disablerepo=uppsyncd --enablerepo=uppsyncd-unstable uppsyncd
        fi
    else
        if has_command dnf; then
            $SUDO dnf install -y uppsyncd
        else
            $SUDO yum install -y uppsyncd
        fi
    fi
}

install_apk() {
    echo "Detected APK package manager."
    install_curl

    echo "Adding RSA key..."
    curl -fsSL "$RSA_KEY_URL" | $SUDO tee /etc/apk/keys/uppsync.rsa.pub > /dev/null

    echo "Adding repository..."
    if ! grep -q "$REPO_URL/alpine/$CHANNEL" /etc/apk/repositories; then
        echo "$REPO_URL/alpine/$CHANNEL" | $SUDO tee -a /etc/apk/repositories > /dev/null
    fi

    echo "Installing uppsyncd..."
    $SUDO apk update
    $SUDO apk add uppsyncd
}

install_binary() {
    if [ "$CHANNEL" = "unstable" ]; then
        echo "Warning: Unstable channel not supported for static binary installation. Falling back to stable (latest release)."
    fi

    echo "No supported package manager found. Installing static binary."
    install_curl

    BINARY_NAME="uppsyncd-linux-$ARCH"

    DOWNLOAD_URL="$BINARY_URL_BASE/$BINARY_NAME"

    echo "Downloading $DOWNLOAD_URL..."
    curl -fsSL "$DOWNLOAD_URL" -o uppsyncd
    chmod +x uppsyncd

    echo "Installing to /usr/local/bin..."
    $SUDO mv uppsyncd /usr/local/bin/uppsyncd
}

main() {
    detect_os
    detect_arch

    echo "Uppsync Installer"
    echo "OS: $OS"
    echo "Arch: $ARCH"

    set -x

    if has_command apt-get; then
        install_apt
    elif has_command dnf || has_command yum; then
        install_rpm
    elif has_command apk; then
        install_apk
    else
        install_binary
    fi

    echo ""
    echo "Installation complete! Log in to start using uppsyncd by running:"
    echo ""
    echo "sudo uppsyncd up"
    echo ""
}

main
