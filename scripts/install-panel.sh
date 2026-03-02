#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="/opt/lxc-manager"
GHCR_NAMESPACE="ghcr.io/fearless743/vm-manager"
IMAGE_TAG="latest"
HTTP_PORT="8080"
JWT_SECRET=""
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"
DEFAULT_USERNAME="user1"
DEFAULT_USER_PASSWORD="user123"
CORS_ORIGINS=""
ALLOWED_HOST_KEYS=""

usage() {
  cat <<'EOF'
用法：
  install-panel.sh [options]

可选参数：
  --base-dir <dir>                 安装目录，默认 /opt/lxc-manager
  --ghcr-namespace <ns>            镜像命名空间，默认 ghcr.io/fearless743/vm-manager
  --image-tag <tag>                镜像标签，默认 latest
  --http-port <port>               面板对外端口，默认 8080
  --jwt-secret <secret>            JWT 密钥（推荐显式传入）
  --admin-username <name>          管理员用户名，默认 admin
  --admin-password <password>      管理员密码，默认 admin123
  --default-username <name>        默认普通用户，默认 user1
  --default-user-password <pwd>    默认普通用户密码，默认 user123
  --cors-origins <origins>         CORS_ORIGINS，默认自动使用 http://localhost:<port>
  --allowed-host-keys <keys>       初始化节点密钥列表（逗号分隔，可选）
  --ghcr-username <name>           可选，GHCR 用户名（私有仓库时使用）
  --ghcr-token <token>             可选，GHCR Token（私有仓库时使用）
  -h, --help                       查看帮助

示例：
  sudo bash install-panel.sh \
    --http-port 8080 \
    --jwt-secret 'replace-with-strong-secret' \
    --admin-password 'replace-admin-password'
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少命令：$1" >&2
    exit 1
  fi
}

GHCR_USERNAME=""
GHCR_TOKEN=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --base-dir)
      BASE_DIR="$2"
      shift 2
      ;;
    --ghcr-namespace)
      GHCR_NAMESPACE="$2"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --http-port)
      HTTP_PORT="$2"
      shift 2
      ;;
    --jwt-secret)
      JWT_SECRET="$2"
      shift 2
      ;;
    --admin-username)
      ADMIN_USERNAME="$2"
      shift 2
      ;;
    --admin-password)
      ADMIN_PASSWORD="$2"
      shift 2
      ;;
    --default-username)
      DEFAULT_USERNAME="$2"
      shift 2
      ;;
    --default-user-password)
      DEFAULT_USER_PASSWORD="$2"
      shift 2
      ;;
    --cors-origins)
      CORS_ORIGINS="$2"
      shift 2
      ;;
    --allowed-host-keys)
      ALLOWED_HOST_KEYS="$2"
      shift 2
      ;;
    --ghcr-username)
      GHCR_USERNAME="$2"
      shift 2
      ;;
    --ghcr-token)
      GHCR_TOKEN="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数：$1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd docker

if ! docker compose version >/dev/null 2>&1; then
  echo "未检测到 docker compose，请先安装 Docker Compose 插件" >&2
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
fi

if [ -z "$CORS_ORIGINS" ]; then
  CORS_ORIGINS="http://localhost:${HTTP_PORT}"
fi

mkdir -p "$BASE_DIR/data"

if [ -n "$GHCR_USERNAME" ] && [ -n "$GHCR_TOKEN" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

cat > "${BASE_DIR}/docker-compose.yml" <<EOF
services:
  backend:
    image: ${GHCR_NAMESPACE}/backend:${IMAGE_TAG}
    container_name: lxc-manager-backend
    environment:
      BACKEND_PORT: "4000"
      JWT_SECRET: "${JWT_SECRET}"
      ALLOWED_HOST_KEYS: "${ALLOWED_HOST_KEYS}"
      CORS_ORIGINS: "${CORS_ORIGINS}"
      DATA_FILE: "data/store.json"
      ADMIN_USERNAME: "${ADMIN_USERNAME}"
      ADMIN_PASSWORD: "${ADMIN_PASSWORD}"
      DEFAULT_USERNAME: "${DEFAULT_USERNAME}"
      DEFAULT_USER_PASSWORD: "${DEFAULT_USER_PASSWORD}"
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  frontend:
    image: ${GHCR_NAMESPACE}/frontend:${IMAGE_TAG}
    container_name: lxc-manager-frontend
    ports:
      - "${HTTP_PORT}:80"
    restart: unless-stopped
    depends_on:
      - backend
EOF

docker compose -f "${BASE_DIR}/docker-compose.yml" pull
docker compose -f "${BASE_DIR}/docker-compose.yml" up -d

echo "面板端安装完成。"
echo "访问地址: http://localhost:${HTTP_PORT}"
echo "管理员账号: ${ADMIN_USERNAME}"
echo "管理员密码: ${ADMIN_PASSWORD}"
echo "配置目录: ${BASE_DIR}"
