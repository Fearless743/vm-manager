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

export function LoginRoute(props: LoginRouteProps): JSX.Element {
  const { error, loginSubtitle, onLogin, onPasswordChange, onUsernameChange, password, siteTitle, username } = props;

  return (
    <main className="page login-page">
      <section className="card login-card">
        <div className="login-head">
          <p className="login-eyebrow">LXC MANAGER</p>
          <h1>{siteTitle}</h1>
          <p>{loginSubtitle}</p>
        </div>
        <label>
          用户名
          <input value={username} onChange={(event) => onUsernameChange(event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} />
        </label>
        <button className="btn btn-primary" onClick={onLogin}>登录</button>
        {error && <p className="error">{error}</p>}
      </section>
    </main>
  );
}
