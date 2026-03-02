# LXC Manager (Docker-based VM manager)

This project contains three parts:

- `apps/backend`: API + auth/RBAC + agent WebSocket hub.
- `apps/agent`: host-side runtime agent, receives commands and manages Docker containers.
- `apps/frontend`: web UI for users and admins.

## Core behavior

- Agent identifies host via `HOST_KEY` and registers to backend with shared secret.
- Backend sends VM lifecycle commands (`create/start/stop/delete`) via WebSocket.
- VM implementation uses Docker containers (interactive Linux image with SSH).
- Create VM allocates:
  - random SSH password,
  - one host SSH port,
  - 100 additional open ports.
- User can view only owned VMs; admin can view/control all VMs.

## Quick start

### One command (recommended for dev)

Run from project root:

```bash
docker compose up --build -d
```

After startup:

- Frontend: `http://localhost:8080`
- Backend API: same origin via `http://localhost:8080/api` (no cross-origin)

Stop services:

```bash
docker compose down
```

### Manual start

1. Install dependencies:

```bash
npm install
```

2. Start backend:

```bash
npm run dev -w @lxc-manager/backend
```

3. Start agent (Go, on host that has Docker):

```bash
cd apps/agent
HOST_KEY=host-dev-001 AGENT_SHARED_SECRET=dev-agent-secret-change-me go run .
```

4. Start frontend:

```bash
npm run dev -w @lxc-manager/frontend
```

## Default accounts

- Admin: `admin` / `admin123`
- User: `user1` / `user123`

Override by environment variables in backend process:

- `ADMIN_USERNAME`, `ADMIN_PASSWORD`
- `DEFAULT_USERNAME`, `DEFAULT_USER_PASSWORD`

## Role capabilities

- Admin can manage host nodes, create VM by selecting host and system option, assign VM owner to any user, and control all VMs.
- Admin can manage multiple users (create user, change role, reset password, delete user).
- User can control only owned VMs: start, stop, reboot, reinstall system, reset SSH password.
- VM delete remains admin-only.

## Host and system flow

- VM creation no longer requires entering container image manually.
- Backend provides fixed system options (`/api/systems`) and frontend uses a selector.
- VM creation is host-selection based (`/api/hosts` + `/api/vms`) and owner assignment happens after creation (`/api/vms/:vmId/assign`).
- Host node key (`hostKey`) is auto-generated randomly by backend when creating a host node, and is used by WebSocket agent registration to distinguish nodes.
- VM creation supports optional resource settings: disk size (GB), CPU cores, memory (MB), and bandwidth (Mbps).

## Security knobs

- `ALLOWED_HOST_KEYS`: comma-separated host keys allowed to register as agents.
- `CORS_ORIGINS`: comma-separated frontend origins allowed to call backend API.

## Single-port deployment mode

- Docker compose now exposes only one public port (`8080`).
- `frontend` (nginx) serves static UI and proxies `/api`, `/ui-ws`, `/agent-ws` to internal backend service.
- This allows you to place an external nginx in front later without browser cross-origin calls.

## GitHub Actions (GHCR + Agent Binaries)

Workflow file: `.github/workflows/release.yml`

What it does:

- Builds and pushes Docker images to GHCR:
  - `ghcr.io/<owner>/<repo>/backend`
  - `ghcr.io/<owner>/<repo>/frontend`
  - `ghcr.io/<owner>/<repo>/agent`
- Builds multi-platform agent binaries:
  - `linux/amd64`, `linux/arm64`
  - `darwin/amd64`, `darwin/arm64`
  - `windows/amd64`
- On tag (`v*`), uploads agent binaries as GitHub Release assets.

Triggers:

- Push to `main`
- Push tag matching `v*`
- Manual run (`workflow_dispatch`)

Required repository settings:

- Keep `GITHUB_TOKEN` enabled for package write.
- Repository Actions permissions should allow `contents: write` and `packages: write`.

## Agent one-click install script

Script: `scripts/install-agent.sh`

### Quick install with systemd service

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install-agent.sh | sudo bash -s -- \
  --repo <owner>/<repo> \
  --version latest \
  --host-key <host-key-from-admin-panel> \
  --backend-ws-url wss://<your-domain>/agent-ws \
  --agent-shared-secret <agent-shared-secret>
```

### Binary-only install (no systemd)

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install-agent.sh | sudo bash -s -- \
  --repo <owner>/<repo> \
  --version latest \
  --no-service
```

### Script options

- `--repo <owner/repo>`: required, release asset source.
- `--version <tag|latest>`: release version to download.
- `--install-dir <path>`: binary destination, default `/usr/local/bin`.
- `--no-service`: only install binary.
- Service required options:
  - `--host-key`
  - `--backend-ws-url`
  - `--agent-shared-secret`

### Service files created

- Env file: `/etc/lxc-manager-agent.env`
- Systemd unit: `/etc/systemd/system/lxc-manager-agent.service`

### Service management

```bash
sudo systemctl status lxc-manager-agent
sudo journalctl -u lxc-manager-agent -f
sudo systemctl restart lxc-manager-agent
```
