import type { HostRow } from "../types";

type HostsRouteProps = {
  hosts: HostRow[];
  onCreateHost: () => void;
  onToggleHost: (hostKey: string, enabled: boolean) => void;
  onResetHostSecret: (hostKey: string) => void;
  onShowAgentInstallCommand: (host: HostRow) => void;
};

export function HostsRoute(props: HostsRouteProps): JSX.Element {
  return (
    <section className="card page-panel hosts-panel route-shell">
      <div className="route-header">
        <h2 className="section-title">宿主机节点</h2>
        <p className="route-subtitle">统一管理接入节点，监控状态并快速执行运维动作。</p>
      </div>
      <div className="actions">
        <button className="btn btn-primary" onClick={props.onCreateHost}>新增宿主机</button>
      </div>
      <div className="vm-list">
        {props.hosts.map((host) => {
          const statusClassName = host.online ? "status-running" : "status-stopped";
          const statusLabel = host.online ? "在线" : "离线";
          const enabledLabel = host.enabled ? "停用" : "启用";
          const hostStats = host.stats;
          const cpuText = hostStats ? `${hostStats.cpuUsagePercent.toFixed(1)}% / ${hostStats.cpuCores}核` : "-";
          const memoryText = hostStats ? `${hostStats.memoryUsedMb} / ${hostStats.memoryTotalMb} MB` : "-";
          const diskText = hostStats ? `${hostStats.diskUsedGb} / ${hostStats.diskTotalGb} GB` : "-";
          const networkText = hostStats
            ? `↓${hostStats.networkRxMbps.toFixed(2)} ↑${hostStats.networkTxMbps.toFixed(2)} Mbps`
            : "-";

          return (
            <article className="vm-item" key={host.hostKey}>
              <div className="vm-head">
                <h3>{host.name}</h3>
                <span className={`status ${statusClassName}`}>{statusLabel}</span>
              </div>
              <p>节点密钥: {host.hostKey}</p>
              <p>启用状态: {host.enabled ? "启用" : "停用"}</p>
              <p>Agent: {host.agentName ?? "-"}</p>
              <p>CPU: {cpuText}</p>
              <p>内存: {memoryText}</p>
              <p>硬盘: {diskText}</p>
              <p>网络: {networkText}</p>
              <div className="actions">
                <button className="btn btn-muted" onClick={() => props.onToggleHost(host.hostKey, !host.enabled)}>{enabledLabel}</button>
                <button className="btn btn-warning" onClick={() => props.onResetHostSecret(host.hostKey)}>重置节点密钥</button>
                <button className="btn btn-secondary" onClick={() => props.onShowAgentInstallCommand(host)}>一键安装命令</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
