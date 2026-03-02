import type { HostRow } from "../types";

type HostsRouteProps = {
  hosts: HostRow[];
  onCreateHost: () => void;
  onToggleHost: (hostKey: string, enabled: boolean) => void;
  onResetHostSecret: (hostKey: string) => void;
  onShowAgentInstallCommand: (host: HostRow) => void;
};

export function HostsRoute(props: HostsRouteProps) {
  return (
    <section className="card">
      <h2 className="section-title">宿主机节点管理</h2>
      <div className="actions">
        <button className="btn btn-primary" onClick={props.onCreateHost}>新增宿主机</button>
      </div>
      <div className="vm-list">
        {props.hosts.map((host) => (
          <article className="vm-item" key={host.hostKey}>
            <div className="vm-head">
              <h3>{host.name}</h3>
              <span className={`status ${host.online ? "status-running" : "status-stopped"}`}>{host.online ? "在线" : "离线"}</span>
            </div>
            <p>节点密钥: {host.hostKey}</p>
            <p>启用状态: {host.enabled ? "启用" : "停用"}</p>
            <p>Agent: {host.agentName ?? "-"}</p>
            <p>CPU: {host.stats ? `${host.stats.cpuUsagePercent.toFixed(1)}% / ${host.stats.cpuCores}核` : "-"}</p>
            <p>内存: {host.stats ? `${host.stats.memoryUsedMb} / ${host.stats.memoryTotalMb} MB` : "-"}</p>
            <p>硬盘: {host.stats ? `${host.stats.diskUsedGb} / ${host.stats.diskTotalGb} GB` : "-"}</p>
            <p>网络: {host.stats ? `↓${host.stats.networkRxMbps.toFixed(2)} ↑${host.stats.networkTxMbps.toFixed(2)} Mbps` : "-"}</p>
            <div className="actions">
              <button className="btn btn-muted" onClick={() => props.onToggleHost(host.hostKey, !host.enabled)}>{host.enabled ? "停用" : "启用"}</button>
              <button className="btn btn-warning" onClick={() => props.onResetHostSecret(host.hostKey)}>重置节点密钥</button>
              <button className="btn btn-secondary" onClick={() => props.onShowAgentInstallCommand(host)}>一键安装命令</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
