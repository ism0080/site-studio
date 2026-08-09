import Icon from "./Icon.jsx";

const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export default function Sidebar({ active, onChange, user, onSignOut }) {
  const items = [
    ["overview", "Overview", "grid"],
    ["editor", "Site editor", "pen"],
    ["templates", "Templates", "layers"],
    ["leads", "Leads", "users"],
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">✳</span>
        <span>
          site<span className="brand-dot">.</span>studio
        </span>
      </div>
      <div className="workspace-label">Workspace</div>
      <nav>
        {items.map(([id, label, icon]) => (
          <button
            className={`nav-item ${active === id ? "active" : ""}`}
            key={id}
            onClick={() => onChange(id)}
          >
            <Icon name={icon} />
            <span>{label}</span>
            {id === "leads" && <span className="nav-badge">3</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item">
          <Icon name="settings" />
          <span>Settings</span>
        </button>
        <div className="profile">
          <div className="avatar">{initials(user?.name)}</div>
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
          <Icon name="more" size={16} />
          <button className="sign-out" onClick={onSignOut} title="Sign out">
            ⎋
          </button>
        </div>
      </div>
    </aside>
  );
}
