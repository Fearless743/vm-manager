import type { HostRow, VmRow } from "../types";

type OverviewRouteProps = {
  vms: VmRow[];
  hosts: HostRow[];
};

export function OverviewRoute(props: OverviewRouteProps) {
  return (
    <section className="card">
      <h2 className="section-title">总览</h2>
      <div className="vm-list">
        <article className="vm-item">
          <h3>虚拟机总数</h3>
          <p>{props.vms.length}</p>
        </article>
        <article className="vm-item">
          <h3>未分配虚拟机</h3>
          <p>{props.vms.filter((vm) => vm.ownerUsername === "unassigned").length}</p>
        </article>
        <article className="vm-item">
          <h3>宿主机节点</h3>
          <p>{props.hosts.length}</p>
        </article>
        <article className="vm-item">
          <h3>在线宿主机</h3>
          <p>{props.hosts.filter((host) => host.online).length}</p>
        </article>
      </div>
    </section>
  );
}
