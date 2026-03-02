import type { HostRow, VmRow } from "../types";

type OverviewRouteProps = {
  vms: VmRow[];
  hosts: HostRow[];
};

export function OverviewRoute(props: OverviewRouteProps): JSX.Element {
  const { hosts, vms } = props;
  const unassigned = vms.filter((vm) => vm.ownerUsername === "unassigned").length;
  const onlineHosts = hosts.filter((host) => host.online).length;

  return (
    <section className="card page-panel overview-panel route-shell">
      <div className="route-header">
        <h2 className="section-title">控制台总览</h2>
        <p className="route-subtitle">实时概览节点与实例状态，快速识别资源分配与异常趋势。</p>
      </div>
      <div className="vm-list stats-grid">
        <article className="vm-item metric-item stat-tile">
          <h3>虚拟机总数</h3>
          <p className="kpi-value">{vms.length}</p>
        </article>
        <article className="vm-item metric-item stat-tile">
          <h3>未分配虚拟机</h3>
          <p className="kpi-value">{unassigned}</p>
        </article>
        <article className="vm-item metric-item stat-tile">
          <h3>宿主机节点</h3>
          <p className="kpi-value">{hosts.length}</p>
        </article>
        <article className="vm-item metric-item stat-tile">
          <h3>在线宿主机</h3>
          <p className="kpi-value">{onlineHosts}</p>
        </article>
      </div>
    </section>
  );
}
