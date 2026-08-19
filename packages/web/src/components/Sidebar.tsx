import "./Sidebar.css";
import type { User } from "better-auth";
import type { View } from "../types.ts";
import Icon, { type IconName } from "./Icon.tsx";
import Brand from "./Brand.tsx";
import Avatar from "./Avatar.tsx";

export default function Sidebar({
  active,
  onChange,
  user,
  onSignOut,
  canLeads,
  canManageMembers,
  isAdmin,
}: {
  active: View;
  onChange: (view: View) => void;
  user: User;
  onSignOut: () => void;
  canLeads: boolean;
  canManageMembers: boolean;
  isAdmin: boolean;
}) {
  const items: Array<[View, string, IconName]> = [
    ["overview", "Overview", "grid"],
    ["editor", "Site editor", "pen"],
    ["templates", "Templates", "layers"],
  ];
  if (canLeads) items.push(["leads", "Leads", "users"]);
  if (canManageMembers) items.push(["access", "Access", "share"]);
  if (isAdmin) items.push(["admin", "Admin", "shield"]);

  return (
    <aside data-component="sidebar">
      <Brand />
      <div className="workspace-label">Workspace</div>
      <nav>
        {items.map(([id, label, icon]) => (
          <button
            className="nav-item"
            data-active={active === id ? "" : undefined}
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
          <Avatar name={user?.name} />
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
