import { createContext, useContext } from "react";

import type { AppMachineContext } from "./appMachine.ts";
import type { Template } from "../siteTypes.ts";

export interface WorkspaceValue {
  /** Authorized user, or null while checking the session. */
  user: AppMachineContext["user"];
  /** True while the initial auth check is in flight. */
  authLoading: boolean;
  /** The editor's working site copy (owned by the app machine). */
  site: AppMachineContext["site"];
  /** True once the site has a persisted backend record. */
  persisted: boolean;
  /** Auto-save indicator for the editor. */
  saveState: AppMachineContext["saveState"];
  publishing: boolean;
  banner: AppMachineContext["banner"];
  domain: AppMachineContext["domain"];
  setup: AppMachineContext["setup"];
  domainError: AppMachineContext["domainError"];
  domainBusy: boolean;
  accessEmail: string;
  accessToggles: AppMachineContext["accessToggles"];
  accessBusy: boolean;
  accessError: AppMachineContext["accessError"];
  adminEmail: string;
  adminBusy: boolean;
  adminError: AppMachineContext["adminError"];
  previewRevision: number;
  meRole?: string;
  isFull: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canLeads: boolean;
  canManageMembers: boolean;
  isAdmin: boolean;
  loadSite: (id: string) => void;
  signIn: () => void;
  signOut: () => void;
  dismissBanner: () => void;
  updateSite: (site: AppMachineContext["site"]) => void;
  selectTemplate: (template: Template) => void;
  publish: () => void;
  domainInput: (domain: string) => void;
  domainConnect: () => void;
  domainVerify: () => void;
  domainRemove: () => void;
  accessEmailInput: (email: string) => void;
  accessToggle: (key: keyof AppMachineContext["accessToggles"]) => void;
  accessInvite: () => void;
  adminEmailInput: (email: string) => void;
  adminInvite: () => void;
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null);

/** Reads the workspace machine/query state; must be used inside the provider. */
export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
