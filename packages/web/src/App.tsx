import { useMachine } from "@xstate/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Device, DomainSetup, SaveState, Site } from "./types.ts";
import Sidebar from "./components/Sidebar.tsx";
import Header from "./components/Header.tsx";
import Overview from "./components/Overview.tsx";
import Templates from "./components/Templates.tsx";
import Leads from "./components/Leads.tsx";
import Access from "./components/Access.tsx";
import Admin from "./components/Admin.tsx";
import EditorPanel from "./components/EditorPanel.tsx";
import Preview from "./components/Preview.tsx";
import { appMachine } from "./lib/appMachine.ts";
import { api, liveUrlFor } from "./lib/api.ts";
import { authClient } from "./lib/auth.ts";
import {
  accessQueries,
  meQueries,
  siteQueries,
  useCreateSite,
  useInviteAgency,
  useInviteMember,
  usePublishSite,
  useRemoveDomain,
  useSetDomain,
  useUpdateSite,
  useVerifyDomain,
} from "./lib/queries.ts";

function SignInScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">✳</span>
          <span>
            site<span className="brand-dot">.</span>studio
          </span>
        </div>
        <h1>Welcome back</h1>
        <p>Sign in to build and publish your sites.</p>
        <button className="dark-button google-button" onClick={onSignIn}>
          <span className="google-mark">G</span> Continue with Google
        </button>
      </div>
    </div>
  );
}

function Editor({
  site,
  online,
  saveState,
  device,
  readOnly,
  manager,
  onDevice,
  onUpdate,
  domain,
  setup,
  domainError,
  domainBusy,
  onDomainInput,
  onDomainConnect,
  onDomainVerify,
  onDomainRemove,
}: {
  site: Site;
  online: boolean | null;
  saveState: SaveState;
  device: Device;
  readOnly: boolean;
  manager: boolean;
  onDevice: (device: Device) => void;
  onUpdate: (site: Site) => void;
  domain: string;
  setup: DomainSetup | null;
  domainError: string | null;
  domainBusy: boolean;
  onDomainInput: (domain: string) => void;
  onDomainConnect: () => void;
  onDomainVerify: () => void;
  onDomainRemove: () => void;
}) {
  return (
    <div className="editor-layout">
      <EditorPanel
        site={site}
        online={online}
        saveState={saveState}
        onUpdate={onUpdate}
        domain={domain}
        setup={setup}
        domainError={domainError}
        domainBusy={domainBusy}
        onDomainInput={onDomainInput}
        onDomainConnect={onDomainConnect}
        onDomainVerify={onDomainVerify}
        onDomainRemove={onDomainRemove}
        readOnly={readOnly}
        manager={manager}
      />
      <div className="preview-area">
        <div className="preview-toolbar">
          <div>
            <span className="live-dot" /> Live preview <span className="toolbar-divider" />{" "}
            <span className="muted">Changes save automatically</span>
          </div>
          <div className="device-toggle">
            <button
              className={device === "desktop" ? "active" : ""}
              onClick={() => onDevice("desktop")}
            >
              Desktop
            </button>
            <button
              className={device === "mobile" ? "active" : ""}
              onClick={() => onDevice("mobile")}
            >
              Mobile
            </button>
          </div>
        </div>
        <Preview site={site} device={device} />
      </div>
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const createSite = useCreateSite();
  const updateSiteMutation = useUpdateSite();
  const publishSite = usePublishSite();
  const setDomain = useSetDomain();
  const verifyDomain = useVerifyDomain();
  const removeDomain = useRemoveDomain();
  const inviteMember = useInviteMember();
  const inviteAgency = useInviteAgency();

  const [snapshot, send] = useMachine(appMachine, {
    input: {
      getSession: () => authClient.getSession().then(({ data }) => data ?? { user: null }),
      signIn: () => authClient.signIn.social({ provider: "google" }),
      signOut: async () => {
        await authClient.signOut();
        window.location.reload();
      },
      listSites: () => api.listSites(),
      createSite: (payload) => createSite.mutateAsync(payload),
      updateSite: (site) => updateSiteMutation.mutateAsync(site),
      publishSite: (id) => publishSite.mutateAsync(id),
      fetchSite: (id) => queryClient.fetchQuery(siteQueries.detail(id)),
      setDomain: (id, domain) => setDomain.mutateAsync({ id, domain }),
      verifyDomain: (id) => verifyDomain.mutateAsync(id),
      removeDomain: (id) => removeDomain.mutateAsync(id),
      inviteMember: (siteId, input) => inviteMember.mutateAsync({ siteId, input }),
      inviteAgency: (email) => inviteAgency.mutateAsync(email),
    },
  });

  const {
    user,
    authLoading,
    active,
    site,
    online,
    saveState,
    publishing,
    banner,
    device,
    sites,
    accessEmail,
    accessToggles,
    accessError,
    adminEmail,
    adminError,
  } = snapshot.context;
  const domainBusy =
    snapshot.matches({ ready: { domain: "connecting" } }) ||
    snapshot.matches({ ready: { domain: "verifying" } }) ||
    snapshot.matches({ ready: { domain: "removing" } });
  const accessBusy = snapshot.matches({ ready: { access: "inviting" } });
  const adminBusy = snapshot.matches({ ready: { admin: "inviting" } });

  const { data: me } = useQuery({ ...meQueries.me(), enabled: user !== null });
  const { data: access } = useQuery({
    ...accessQueries.detail(site.id),
    enabled: online === true && !!site.id,
  });

  const role = me?.role;
  // While access is unknown (loading or offline demo) the optimistic default is
  // full manager access, which keeps the existing single-owner experience intact.
  const isFull = access === undefined || access.kind === "full" || online === false;
  const canEdit = isFull || (access?.kind === "client" && access.canEdit);
  const canPublish = isFull || (access?.kind === "client" && access.canPublish);
  const canLeads = isFull || (access?.kind === "client" && access.canLeads);
  const canManageMembers = (role === "admin" || role === "agency") && isFull;

  // A view the current site/role can't support falls back to the overview.
  const view =
    (active === "leads" && !canLeads) ||
    (active === "access" && !canManageMembers) ||
    (active === "admin" && role !== "admin")
      ? "overview"
      : active;

  if (authLoading) {
    return <div className="auth-screen">Loading…</div>;
  }
  if (!user) {
    return <SignInScreen onSignIn={() => send({ type: "SIGN_IN" })} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        active={active}
        onChange={(next) => send({ type: "SET_VIEW", view: next })}
        user={user}
        onSignOut={() => send({ type: "SIGN_OUT" })}
        canLeads={canLeads}
        canManageMembers={canManageMembers}
        isAdmin={role === "admin"}
      />
      <main className="main-content">
        {banner && (
          <div className={`conn-banner ${banner.kind}`}>
            <span>{banner.message}</span>
            <button className="banner-close" onClick={() => send({ type: "DISMISS_BANNER" })}>
              ×
            </button>
          </div>
        )}
        <Header
          active={view}
          site={site}
          online={online}
          publishing={publishing}
          sites={sites}
          user={user}
          liveUrl={liveUrlFor(site)}
          canPublish={canPublish}
          onPublish={() => send({ type: "PUBLISH" })}
          onSelectSite={(id) => send({ type: "SELECT_SITE", id })}
        />
        {view === "overview" && (
          <Overview
            onEdit={() => send({ type: "SET_VIEW", view: "editor" })}
            site={site}
            sites={sites}
          />
        )}
        {view === "templates" && (
          <Templates onSelect={(template) => send({ type: "SELECT_TEMPLATE", template })} />
        )}
        {view === "leads" && (
          <Leads
            site={site}
            online={online}
            onEdit={() => send({ type: "SET_VIEW", view: "editor" })}
          />
        )}
        {view === "access" && (
          <Access
            site={site}
            online={online}
            email={accessEmail}
            toggles={accessToggles}
            busy={accessBusy}
            error={accessError}
            onEmailInput={(email) => send({ type: "ACCESS_EMAIL_INPUT", email })}
            onToggle={(key) => send({ type: "ACCESS_TOGGLE", key })}
            onInvite={() => send({ type: "ACCESS_INVITE" })}
          />
        )}
        {view === "admin" && (
          <Admin
            online={online}
            email={adminEmail}
            busy={adminBusy}
            error={adminError}
            onEmailInput={(email) => send({ type: "ADMIN_EMAIL_INPUT", email })}
            onInvite={() => send({ type: "ADMIN_INVITE" })}
          />
        )}
        {view === "editor" && (
          <Editor
            site={site}
            online={online}
            saveState={saveState}
            device={device}
            readOnly={!canEdit}
            manager={isFull}
            onDevice={(d) => send({ type: "SET_DEVICE", device: d })}
            onUpdate={(next) => send({ type: "UPDATE", site: next })}
            domain={snapshot.context.domain}
            setup={snapshot.context.setup}
            domainError={snapshot.context.domainError}
            domainBusy={domainBusy}
            onDomainInput={(d) => send({ type: "DOMAIN_INPUT", domain: d })}
            onDomainConnect={() => send({ type: "DOMAIN_CONNECT" })}
            onDomainVerify={() => send({ type: "DOMAIN_VERIFY" })}
            onDomainRemove={() => send({ type: "DOMAIN_REMOVE" })}
          />
        )}
      </main>
    </div>
  );
}
