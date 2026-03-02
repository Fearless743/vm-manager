import type { UserRow } from "../types";

type UsersRouteProps = {
  users: UserRow[];
  onCreateUser: () => void;
  onEditUser: (user: UserRow) => void;
};

export function UsersRoute(props: UsersRouteProps): JSX.Element {
  return (
    <section className="card page-panel users-panel route-shell">
      <div className="route-header">
        <h2 className="section-title">用户与权限</h2>
        <p className="route-subtitle">集中管理账户角色，维护最小权限原则并保持审计可追踪。</p>
      </div>
      <div className="actions">
        <button className="btn btn-primary" onClick={props.onCreateUser}>新增用户</button>
      </div>
      <div className="vm-list">
        {props.users.map((user) => {
          const isAdmin = user.role === "admin";
          const roleLabel = isAdmin ? "管理员" : "用户";
          const roleClassName = isAdmin ? "status-running" : "status-stopped";

          return (
            <article className="vm-item" key={user.id}>
              <div className="vm-head">
                <h3>{user.username}</h3>
                <span className={`status ${roleClassName}`}>{roleLabel}</span>
              </div>
              <p>用户 ID: {user.id}</p>
              <div className="actions">
                <button className="btn btn-secondary" onClick={() => props.onEditUser(user)}>编辑用户</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
