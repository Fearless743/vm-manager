type SettingsRouteProps = {
  siteTitleInput: string;
  loginSubtitleInput: string;
  sidebarTitleInput: string;
  onSiteTitleChange: (value: string) => void;
  onLoginSubtitleChange: (value: string) => void;
  onSidebarTitleChange: (value: string) => void;
  onSave: () => void;
};

export function SettingsRoute(props: SettingsRouteProps) {
  return (
    <section className="card">
      <h2 className="section-title">网站配置</h2>
      <label>
        网站标题（浏览器标题）
        <input value={props.siteTitleInput} onChange={(event) => props.onSiteTitleChange(event.target.value)} />
      </label>
      <label>
        登录页副标题
        <input value={props.loginSubtitleInput} onChange={(event) => props.onLoginSubtitleChange(event.target.value)} />
      </label>
      <label>
        侧边栏标题
        <input value={props.sidebarTitleInput} onChange={(event) => props.onSidebarTitleChange(event.target.value)} />
      </label>
      <div className="actions">
        <button className="btn btn-primary" onClick={props.onSave}>保存配置</button>
      </div>
    </section>
  );
}
