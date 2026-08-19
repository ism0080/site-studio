import "./Sidebar.css";
import { Link } from "@tanstack/react-router";
import type { User } from "better-auth";
import type { Icon } from "@phosphor-icons/react";
import Brand from "./Brand.tsx";
import Avatar from "./Avatar.tsx";
import {
  SignOutIcon,
  GaugeIcon,
  PenIcon,
  StackSimpleIcon,
  UsersIcon,
  ShareIcon,
  ShieldIcon,
} from "@phosphor-icons/react";

interface SidebarProps {
  siteId: string;
  user: User | null;
  onSignOut: () => void;
  canLeads: boolean;
  canManageMembers: boolean;
  isAdmin: boolean;
}

/** The workspace navigation rail, with type-safe links to each view. */
export default function Sidebar({
  siteId,
  user,
  onSignOut,
  canLeads,
  canManageMembers,
  isAdmin,
}: SidebarProps) {
  const items: Array<{ to: string; label: string; Icon: Icon; exact: boolean }> = [
    { to: "/sites/$siteId", label: "Overview", Icon: GaugeIcon, exact: true },
    { to: "/sites/$siteId/editor", label: "Site editor", Icon: PenIcon, exact: true },
    { to: "/sites/$siteId/templates", label: "Templates", Icon: StackSimpleIcon, exact: false },
  ];
  if (canLeads)
    items.push({ to: "/sites/$siteId/leads", label: "Leads", Icon: UsersIcon, exact: false });
  if (canManageMembers)
    items.push({ to: "/sites/$siteId/access", label: "Access", Icon: ShareIcon, exact: false });
  if (isAdmin)
    items.push({ to: "/sites/$siteId/admin", label: "Admin", Icon: ShieldIcon, exact: false });

  return (
    <aside data-component="sidebar">
      <Brand />
      <div data-slot="workspace-label">Workspace</div>
      <nav>
        {items.map(({ to, label, Icon, exact }) => (
          <Link
            key={to}
            to={to}
            params={{ siteId }}
            data-slot="nav-item"
            activeOptions={{ exact }}
            activeProps={{ "data-active": "true" }}
          >
            <Icon size={18} />
            <span>{label}</span>
            {label === "Leads" && <span data-slot="nav-badge">3</span>}
          </Link>
        ))}
      </nav>
      <div data-slot="sidebar-bottom">
        <div data-slot="profile">
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
