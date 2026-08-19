import "./Sidebar.css";
import type { User } from "better-auth";
import type { View } from "../types.ts";
import Brand from "./Brand.tsx";
import Avatar from "./Avatar.tsx";
import {
  SignOutIcon,
  GearIcon,
  GaugeIcon,
  type Icon,
  PenIcon,
  StackSimpleIcon,
  UsersIcon,
  ShareIcon,
  ShieldIcon,
} from "@phosphor-icons/react";

interface SidebarProps {
  active: View;
  onChange: (view: View) => void;
  user: User;
  onSignOut: () => void;
  canLeads: boolean;
  canManageMembers: boolean;
  isAdmin: boolean;
}

export default function Sidebar({
  active,
  onChange,
  user,
  onSignOut,
  canLeads,
  canManageMembers,
  isAdmin,
}: SidebarProps) {
  const items: Array<[View, string, Icon]> = [
    ["overview", "Overview", GaugeIcon],
    ["editor", "Site editor", PenIcon],
    ["templates", "Templates", StackSimpleIcon],
  ];
  if (canLeads) items.push(["leads", "Leads", UsersIcon]);
  if (canManageMembers) items.push(["access", "Access", ShareIcon]);
  if (isAdmin) items.push(["admin", "Admin", ShieldIcon]);

  return (
    <aside data-component="sidebar">
      <Brand />
      <div className="workspace-label">Workspace</div>
      <nav>
        {items.map(([id, label, Icon]) => (
          <button
            className="nav-item"
            data-active={active === id ? "" : undefined}
            key={id}
            onClick={() => onChange(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === "leads" && <span className="nav-badge">3</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item">
          <GearIcon name="settings" />
          <span>Settings</span>
        </button>
        <div className="profile">
          <Avatar name={user?.name} />
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
          <SignOutIcon onClick={onSignOut} size={18} />
        </div>
      </div>
    </aside>
  );
}
