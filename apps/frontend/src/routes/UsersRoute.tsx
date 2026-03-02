import type { UserRow } from "../types";

type UsersRouteProps = {
  users: UserRow[];
  onCreateUser: () => void;
  onEditUser: (user: UserRow) => void;
};

export function UsersRoute(props: UsersRouteProps) {
  return (
    <section className="card">
      <h2 className="section-title">用户管理</h2>
      <div className="actions">
        <button className="btn btn-primary" onClick={props.onCreateUser}>新增用户</button>
      </div>
      <div className="vm-list">
        {props.users.map((user) => (
          <article className="vm-item" key={user.id}>
            <div className="vm-head">
              <h3>{user.username}</h3>
              <span className={`status ${user.role === "admin" ? "status-running" : "status-stopped"}`}>
                {user.role === "admin" ? "管理员" : "用户"}
              </span>
            </div>
            <p>用户 ID: {user.id}</p>
            <div className="actions">
              <button className="btn btn-secondary" onClick={() => props.onEditUser(user)}>编辑用户</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
