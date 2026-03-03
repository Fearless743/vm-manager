# LXC Manager（基于 Docker 的虚拟机管理系统）

本项目包含三部分：

- `apps/backend`：后端 API、认证鉴权（RBAC）、Agent WebSocket 中枢。
- `apps/agent`：宿主机侧 Agent，接收指令并管理 Docker 容器。
- `apps/frontend`：管理界面（管理员 / 用户）。

## 核心能力

- Agent 通过节点密钥（`AGENT_SHARED_SECRET`）注册到后端并区分宿主机节点。
- 后端通过 WebSocket 下发虚拟机生命周期指令（创建/开机/关机/重启/重装/重置密码/删除）。
- 虚拟机以 Docker 交互式 Linux 容器实现（带 SSH）。
- 创建虚拟机时自动生成：
  - 随机 SSH 密码
  - 1 个 SSH 端口
  - 100 个开放端口
- 用户仅可查看和操作自己名下虚拟机；管理员可查看与控制全部虚拟机。
- 支持宿主机节点管理、虚拟机创建后再分配用户。

## 快速启动

### 一条命令启动（推荐开发环境）

在项目根目录执行：

```bash
docker compose up --build -d
```

启动后：

- 前端：`http://localhost:8080`
- 后端 API：同源访问 `http://localhost:8080/api`

停止服务：

```bash
docker compose down
```

### 手动启动

1. 安装依赖：

```bash
npm install
```

2. 启动后端：

```bash
npm run dev -w @vm-manager/backend
```

3. 启动 Agent（在有 Docker 的宿主机上）：

```bash
cd apps/agent
AGENT_SHARED_SECRET=<宿主机节点密钥> go run .
```

4. 启动前端：

```bash
npm run dev -w @vm-manager/frontend
```

## 默认账号

- 管理员：`admin` / `admin123`

可通过后端环境变量覆盖管理员账号：

- `ADMIN_USERNAME`, `ADMIN_PASSWORD`

如需初始化普通用户，可额外设置：

- `DEFAULT_USERNAME`, `DEFAULT_USER_PASSWORD`

## 角色能力

- 管理员：宿主机节点管理、虚拟机创建与分配、全量控制、用户管理（创建/改角色/重置密码/删除）。
- 管理员支持重置宿主机节点密钥（重置后需同步更新对应 Agent 的 `AGENT_SHARED_SECRET`）。
- 用户：仅可操作自己名下虚拟机（开机/关机/重启/重装系统/重置密码）。
- 删除虚拟机仅管理员可执行。

## 安全配置项

- `ALLOWED_HOST_KEYS`：初始化默认节点密钥列表（可选，逗号分隔）。
- `CORS_ORIGINS`：允许访问后端 API 的来源（逗号分隔）。

## VM 数据持久化与删除策略（Agent）

Agent 创建 VM（Docker 容器）时，默认会为每台 VM 创建并挂载一个 Docker named volume：

- Volume 命名：`vm-manager-vm-<vmId>-data`
- 挂载点：`/config`
- 默认开启持久化：`PERSIST_VM_DATA=true`

可通过以下环境变量控制删除行为：

- `DELETE_DATA_ON_DELETE`（默认 `true`）  
  删除 VM 时是否同时删除数据卷。
- `DELETE_DATA_ON_REINSTALL`（默认 `true`）  
  重装 VM 时是否同时删除旧数据卷。

策略建议：

- 如果你希望“删除/重装后保留业务数据”，请将对应变量设为 `false`。
- 如果你希望“删除/重装即彻底清理数据”，保持默认 `true` 即可。

> 说明：backend 的业务元数据（如 VM 记录、端口、状态等）仍保存在 `data/store.db`（Docker 部署下为 `./data` 映射目录）。

## 单端口部署模式

- Docker 仅对外暴露一个端口（`8080`）。
- `frontend`（nginx）统一反代：`/api`、`/ui-ws`、`/agent-ws` 到内部 backend。
- 便于后续你在外层 Nginx 再做统一 HTTPS 反代，不产生浏览器跨域。

## Agent 一键安装脚本

脚本文件：`scripts/install-agent.sh`

脚本行为（默认）：

- 安装 `vm-manager-agent` 二进制到 `/usr/local/bin`。
- 安装 systemd 服务并启动 Agent。
- 在 Linux 下若未安装 Docker，会尝试自动安装并启动 Docker 服务。

### 一键安装并注册 systemd 服务

```bash
curl -fsSL https://raw.githubusercontent.com/Fearless743/vm-manager/main/scripts/install-agent.sh | sudo bash -s -- \
  --version latest \
  --backend-ws-url wss://<你的域名>/agent-ws \
  --agent-shared-secret <你的AGENT_SHARED_SECRET>
```

安装 systemd 服务时，下面两个参数必填：

- `--backend-ws-url`
- `--agent-shared-secret`

### 仅安装二进制（不安装 systemd）

```bash
curl -fsSL https://raw.githubusercontent.com/Fearless743/vm-manager/main/scripts/install-agent.sh | sudo bash -s -- \
  --version latest \
  --no-service
```

说明：使用 `--no-service` 时不会进行 Docker 就绪检查，也不会写入 systemd 文件。

### 常用参数说明

- `--version <tag|latest>`：发布版本。
- `--install-dir <path>`：二进制安装目录（默认 `/usr/local/bin`）。
- `--no-service`：只安装二进制，不写 systemd。
- `--skip-docker-install`：跳过 Docker 自动安装。

### 安装后生成的文件

- 环境变量文件：`/etc/vm-manager-agent.env`
- 服务文件：`/etc/systemd/system/vm-manager-agent.service`

### 服务管理命令

```bash
sudo systemctl status vm-manager-agent
sudo journalctl -u vm-manager-agent -f
sudo systemctl restart vm-manager-agent
```

## 面板端一键安装（生产/测试服务器）

脚本文件：`scripts/install-panel.sh`

该脚本会在目标服务器安装并启动 `backend` 和 `frontend`，默认只暴露一个端口（`8080`）。

脚本行为（默认）：

- 生成 `${BASE_DIR}/docker-compose.yml`（默认目录 `/opt/vm-manager`）。
- 自动创建 `JWT_SECRET`（如果未显式传入 `--jwt-secret`）。
- 首次拉取镜像并后台启动服务。

### 一键安装示例

```bash
curl -fsSL https://raw.githubusercontent.com/Fearless743/vm-manager/main/scripts/install-panel.sh | sudo bash -s -- \
  --http-port 8080 \
  --jwt-secret 'replace-with-strong-secret' \
  --admin-password 'replace-admin-password'
```

### 可选参数（常用）

- `--base-dir`：安装目录（默认 `/opt/vm-manager`）
- `--ghcr-namespace`：镜像命名空间（默认 `ghcr.io/fearless743/vm-manager`）
- `--image-tag`：镜像标签（默认 `latest`）
- `--http-port`：面板端口（默认 `8080`）
- `--jwt-secret`：JWT 密钥（推荐显式传入；不传会自动生成）
- `--admin-username` / `--admin-password`
- `--default-username` / `--default-user-password`
- `--allowed-host-keys`：初始化节点密钥（可选）
- `--ghcr-username` + `--ghcr-token`：私有仓库拉取镜像时使用

### 安装后管理命令

```bash
cd /opt/vm-manager
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose pull && docker compose up -d
```
