type LoginRouteProps = {
  siteTitle: string;
  loginSubtitle: string;
  username: string;
  password: string;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLogin: () => void;
};

export function LoginRoute(props: LoginRouteProps) {
  return (
    <main className="page login-page">
      <section className="card">
        <h1>{props.siteTitle}</h1>
        <p>{props.loginSubtitle}</p>
        <label>
          用户名
          <input value={props.username} onChange={(event) => props.onUsernameChange(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={props.password} onChange={(event) => props.onPasswordChange(event.target.value)} />
        </label>
        <button className="btn btn-primary" onClick={props.onLogin}>登录</button>
        {props.error && <p className="error">{props.error}</p>}
      </section>
    </main>
  );
}
