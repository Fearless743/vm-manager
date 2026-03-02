import type { ReactNode } from "react";

type MyVmsRouteProps = {
  vmCards: ReactNode;
};

export function MyVmsRoute(props: MyVmsRouteProps): JSX.Element {
  const { vmCards } = props;

  return (
    <section className="card page-panel my-vms-panel route-shell">
      <div className="route-header">
        <h2 className="section-title">我的实例</h2>
        <p className="route-subtitle">查看个人实例状态与连接信息，快速处理重启、重装等操作。</p>
      </div>
      {vmCards}
    </section>
  );
}
