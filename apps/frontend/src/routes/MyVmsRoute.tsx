import type { ReactNode } from "react";

type MyVmsRouteProps = {
  vmCards: ReactNode;
};

export function MyVmsRoute(props: MyVmsRouteProps) {
  return (
    <section className="card">
      <h2 className="section-title">我的虚拟机</h2>
      {props.vmCards}
    </section>
  );
}
