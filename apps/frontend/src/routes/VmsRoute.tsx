import type { ReactNode } from "react";

type VmsRouteProps = {
  onCreateVm: () => void;
  vmCards: ReactNode;
};

export function VmsRoute(props: VmsRouteProps): JSX.Element {
  const { onCreateVm, vmCards } = props;

  return (
    <section className="card page-panel vms-panel route-shell">
      <div className="route-header">
        <h2 className="section-title">虚拟机资源池</h2>
        <p className="route-subtitle">创建、控制与维护实例生命周期，保持资源利用率与稳定性平衡。</p>
      </div>
      <div className="actions">
        <button className="btn btn-primary" onClick={onCreateVm}>新建虚拟机</button>
      </div>
      {vmCards}
    </section>
  );
}
