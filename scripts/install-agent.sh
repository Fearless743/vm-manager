#!/usr/bin/env bash
set -euo pipefail

REPO="Fearless743/vm-manager"
VERSION="latest"
INSTALL_DIR="/usr/local/bin"
INSTALL_SERVICE="true"
BACKEND_WS_URL=""
AGENT_SHARED_SECRET=""
AGENT_NAME=""
SSH_CONTAINER_PORT="2222"
MIN_HOST_PORT="20000"
MAX_HOST_PORT="60000"
EXTRA_OPEN_PORT_COUNT="100"
SSH_USERNAME="vmuser"

usage() {
  cat <<'EOF'
Usage:
  install-agent.sh [options]

Options:
  --version <tag|latest>            Release tag, default: latest
  --install-dir <path>              Install dir, default: /usr/local/bin
  --no-service                      Install binary only (skip systemd)

Service env options (required unless --no-service):
  --backend-ws-url <ws-url>
  --agent-shared-secret <secret>

Optional service env:
  --agent-name <name>
  --ssh-container-port <port>
  --min-host-port <port>
  --max-host-port <port>
  --extra-open-port-count <count>
  --ssh-username <username>

Example:
  sudo bash install-agent.sh \
    --version latest \
    --backend-ws-url wss://example.com/agent-ws \
    --agent-shared-secret 'replace-me'
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing command: $1" >&2
    exit 1
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --no-service)
      INSTALL_SERVICE="false"
      shift
      ;;
    --backend-ws-url)
      BACKEND_WS_URL="$2"
      shift 2
      ;;
    --agent-shared-secret)
      AGENT_SHARED_SECRET="$2"
      shift 2
      ;;
    --agent-name)
      AGENT_NAME="$2"
      shift 2
      ;;
    --ssh-container-port)
      SSH_CONTAINER_PORT="$2"
      shift 2
      ;;
    --min-host-port)
      MIN_HOST_PORT="$2"
      shift 2
      ;;
    --max-host-port)
      MAX_HOST_PORT="$2"
      shift 2
      ;;
    --extra-open-port-count)
      EXTRA_OPEN_PORT_COUNT="$2"
      shift 2
      ;;
    --ssh-username)
      SSH_USERNAME="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd curl
require_cmd tar
require_cmd unzip
require_cmd mktemp
require_cmd python3

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH_RAW="$(uname -m)"

case "$OS" in
  linux|darwin) ;;
  *)
    echo "unsupported OS: $OS" >&2
    exit 1
    ;;
esac

case "$ARCH_RAW" in
  x86_64|amd64)
    ARCH="amd64"
    ;;
  aarch64|arm64)
    ARCH="arm64"
    ;;
  *)
    echo "unsupported arch: $ARCH_RAW" >&2
    exit 1
    ;;
esac

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

if [ "$VERSION" = "latest" ]; then
  API_URL="https://api.github.com/repos/${REPO}/releases/latest"
else
  API_URL="https://api.github.com/repos/${REPO}/releases/tags/${VERSION}"
fi

echo "Fetching release metadata from ${API_URL}"
METADATA_FILE="${TMP_DIR}/release.json"
curl -fsSL "$API_URL" -o "$METADATA_FILE"

ASSET_NAME_PREFIX="vm-manager-agent-${OS}-${ARCH}"
ASSET_URL="$(python3 - "$METADATA_FILE" "$ASSET_NAME_PREFIX" <<'PY'
import json
import sys

path = sys.argv[1]
prefix = sys.argv[2]
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for asset in data.get('assets', []):
    name = asset.get('name', '')
    if name.startswith(prefix) and (name.endswith('.tar.gz') or name.endswith('.zip')):
        print(asset.get('browser_download_url', ''))
        break
PY
)"

if [ -z "$ASSET_URL" ]; then
  echo "unable to find asset for ${ASSET_NAME_PREFIX}" >&2
  exit 1
fi

ASSET_FILE="${TMP_DIR}/asset"
echo "Downloading ${ASSET_URL}"
curl -fsSL "$ASSET_URL" -o "$ASSET_FILE"

mkdir -p "$INSTALL_DIR"

if [[ "$ASSET_URL" == *.zip ]]; then
  unzip -o "$ASSET_FILE" -d "$TMP_DIR"
else
  tar -xzf "$ASSET_FILE" -C "$TMP_DIR"
fi

BIN_SRC="${TMP_DIR}/vm-manager-agent-${OS}-${ARCH}"
if [ ! -f "$BIN_SRC" ]; then
  echo "downloaded archive does not contain expected binary: $BIN_SRC" >&2
  exit 1
fi

install -m 0755 "$BIN_SRC" "${INSTALL_DIR}/vm-manager-agent"
echo "Installed binary: ${INSTALL_DIR}/vm-manager-agent"

if [ "$INSTALL_SERVICE" != "true" ]; then
  echo "Binary-only install complete."
  exit 0
fi

if [ -z "$BACKEND_WS_URL" ] || [ -z "$AGENT_SHARED_SECRET" ]; then
  echo "--backend-ws-url and --agent-shared-secret are required for service install" >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl not found, skip service setup" >&2
  exit 0
fi

if [ -z "$AGENT_NAME" ]; then
  AGENT_NAME="$(hostname)-agent"
fi

ENV_FILE="/etc/vm-manager-agent.env"
SERVICE_FILE="/etc/systemd/system/vm-manager-agent.service"

cat > "$ENV_FILE" <<EOF
BACKEND_WS_URL=${BACKEND_WS_URL}
AGENT_NAME=${AGENT_NAME}
AGENT_SHARED_SECRET=${AGENT_SHARED_SECRET}
SSH_CONTAINER_PORT=${SSH_CONTAINER_PORT}
MIN_HOST_PORT=${MIN_HOST_PORT}
MAX_HOST_PORT=${MAX_HOST_PORT}
EXTRA_OPEN_PORT_COUNT=${EXTRA_OPEN_PORT_COUNT}
SSH_USERNAME=${SSH_USERNAME}
EOF

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=LXC Manager Agent
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
ExecStart=${INSTALL_DIR}/vm-manager-agent
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now vm-manager-agent

echo "Service installed and started: vm-manager-agent"
echo "Check logs: journalctl -u vm-manager-agent -f"
