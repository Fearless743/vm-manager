import type { ReactNode } from "react";

type VmsRouteProps = {
  onCreateVm: () => void;
  vmCards: ReactNode;
};

export function VmsRoute(props: VmsRouteProps) {
  return (
    <section className="card">
      <h2 className="section-title">虚拟机</h2>
      <div className="actions">
        <button className="btn btn-primary" onClick={props.onCreateVm}>新建虚拟机</button>
      </div>
      {props.vmCards}
    </section>
  );
}
