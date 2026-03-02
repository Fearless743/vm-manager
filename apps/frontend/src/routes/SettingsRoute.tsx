type SettingsRouteProps = {
  siteTitleInput: string;
  loginSubtitleInput: string;
  onSiteTitleChange: (value: string) => void;
  onLoginSubtitleChange: (value: string) => void;
  onSave: () => void;
};

export function SettingsRoute(props: SettingsRouteProps): JSX.Element {
  const { loginSubtitleInput, onLoginSubtitleChange, onSave, onSiteTitleChange, siteTitleInput } = props;

  return (
    <section className="card page-panel settings-panel route-shell">
      <div className="route-header">
        <h2 className="section-title">站点配置</h2>
        <p className="route-subtitle">自定义产品文案与品牌信息，让控制台呈现一致的对外体验。</p>
      </div>
      <label>
        网站标题（浏览器标题 + 侧边栏标题）
        <input value={siteTitleInput} onChange={(event) => onSiteTitleChange(event.target.value)} />
      </label>
      <label>
        登录页副标题
        <input value={loginSubtitleInput} onChange={(event) => onLoginSubtitleChange(event.target.value)} />
      </label>
      <div className="actions">
        <button className="btn btn-primary" onClick={onSave}>保存配置</button>
      </div>
    </section>
  );
}
