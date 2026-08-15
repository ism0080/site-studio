import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "better-auth";
import type { Device, DomainSetup, SaveState, Site, Template, View } from "./types.ts";
import Sidebar from "./components/Sidebar.tsx";
import Header from "./components/Header.tsx";
import Overview from "./components/Overview.tsx";
import Templates from "./components/Templates.tsx";
import Leads from "./components/Leads.tsx";
import EditorPanel from "./components/EditorPanel.tsx";
import Preview from "./components/Preview.tsx";
import { initialSite } from "./data/site.ts";
import { errorMessage, fromApiSite, liveUrlFor, toApiSite } from "./lib/api.ts";
import { authClient } from "./lib/auth.ts";
import {
  siteQueries,
  useCreateSite,
  usePublishSite,
  useRemoveDomain,
  useSetDomain,
  useUpdateSite,
  useVerifyDomain,
} from "./lib/queries.ts";

interface Banner {
  kind: "error" | "success";
  message: string;
}

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
  onUpdate,
  onSetDomain,
  onVerifyDomain,
  onRemoveDomain,
}: {
  site: Site;
  online: boolean | null;
  saveState: SaveState;
  onUpdate: (site: Site) => void;
  onSetDomain: (domain: string) => Promise<DomainSetup>;
  onVerifyDomain: () => Promise<Site>;
  onRemoveDomain: () => Promise<Site>;
}) {
  const [device, setDevice] = useState<Device>("desktop");
  return (
    <div className="editor-layout">
      <EditorPanel
        site={site}
        online={online}
        saveState={saveState}
        onUpdate={onUpdate}
        onSetDomain={onSetDomain}
        onVerifyDomain={onVerifyDomain}
        onRemoveDomain={onRemoveDomain}
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
              onClick={() => setDevice("desktop")}
            >
              Desktop
            </button>
            <button
              className={device === "mobile" ? "active" : ""}
              onClick={() => setDevice("mobile")}
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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [active, setActive] = useState<View>("overview");
  const [site, setSite] = useState<Site>(initialSite);
  const [persisted, setPersisted] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const siteRef = useRef(site);
  const persistedRef = useRef(persisted);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const queryClient = useQueryClient();
  const sitesQuery = useQuery({ ...siteQueries.list(), enabled: !!user });
  const sites = sitesQuery.data ?? [];

  const createSite = useCreateSite();
  const updateSiteMutation = useUpdateSite();
  const publishSite = usePublishSite();
  const setDomain = useSetDomain();
  const verifyDomain = useVerifyDomain();
  const removeDomain = useRemoveDomain();

  useEffect(() => {
    authClient
      .getSession()
      .then(({ data }) => {
        setUser(data?.user ?? null);
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  const handleSignIn = () => {
    authClient.signIn.social({ provider: "google" });
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    setUser(null);
    window.location.reload();
  };

  const updateSite = useCallback((next: Site) => {
    siteRef.current = next;
    setSite(next);
  }, []);

  const setPersistedFlag = useCallback((value: boolean) => {
    persistedRef.current = value;
    setPersisted(value);
  }, []);

  // Drive the online/offline banner and select the first persisted site from
  // the sites list once it arrives.
  useEffect(() => {
    if (sitesQuery.isError) {
      setOnline(false);
      setBanner({
        kind: "error",
        message: "API unreachable — showing local demo data. Start the API and reload to go live.",
      });
      return;
    }
    if (!sitesQuery.isSuccess) return;
    setOnline(true);
    if (sitesQuery.data.length > 0 && !persistedRef.current) {
      updateSite(fromApiSite(sitesQuery.data[0]));
      setPersistedFlag(true);
    }
  }, [sitesQuery.isError, sitesQuery.isSuccess, sitesQuery.data, updateSite, setPersistedFlag]);

  // Persist the current site to the API (create on first save, then update).
  const commit = useCallback(
    async (next: Site) => {
      setSaveState("saving");
      try {
        if (persistedRef.current) {
          await updateSiteMutation.mutateAsync(toApiSite(next));
        } else {
          const created = await createSite.mutateAsync({
            name: next.business.name,
            templateId: next.templateId,
          });
          updateSite(fromApiSite(created));
          setPersistedFlag(true);
        }
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        setBanner({ kind: "error", message: `Save failed: ${errorMessage(e)}` });
      }
    },
    [updateSiteMutation, createSite, updateSite, setPersistedFlag],
  );

  const handleUpdate = useCallback(
    (next: Site) => {
      updateSite(next);
      if (online !== true) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => commit(next), 800);
    },
    [updateSite, online, commit],
  );

  // Returns a persisted site id, creating the site if the demo site was never saved.
  const ensurePersisted = useCallback(async (): Promise<string> => {
    if (persistedRef.current) return siteRef.current.id;
    const created = await createSite.mutateAsync({
      name: siteRef.current.business.name,
      templateId: siteRef.current.templateId,
    });
    updateSite(fromApiSite(created));
    setPersistedFlag(true);
    return created.id;
  }, [createSite, updateSite, setPersistedFlag]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setBanner(null);
    try {
      const id = await ensurePersisted();
      await publishSite.mutateAsync(id);
      const updated = await queryClient.fetchQuery(siteQueries.detail(id));
      updateSite(fromApiSite(updated));
      setBanner({
        kind: "success",
        message:
          "Published. Static HTML is generated by the Astro build step (run `bun run publish` in packages/site-template).",
      });
    } catch (e) {
      setBanner({ kind: "error", message: `Publish failed: ${errorMessage(e)}` });
    } finally {
      setPublishing(false);
    }
  }, [ensurePersisted, publishSite, queryClient, updateSite]);

  const handleSetDomain = useCallback(
    async (domain: string): Promise<DomainSetup> => {
      const id = await ensurePersisted();
      return setDomain.mutateAsync({ id, domain });
    },
    [ensurePersisted, setDomain],
  );

  const handleVerifyDomain = useCallback(async (): Promise<Site> => {
    const id = await ensurePersisted();
    const updated = await verifyDomain.mutateAsync(id);
    updateSite(fromApiSite(updated));
    return updated;
  }, [ensurePersisted, verifyDomain, updateSite]);

  const handleRemoveDomain = useCallback(async (): Promise<Site> => {
    const id = await ensurePersisted();
    const updated = await removeDomain.mutateAsync(id);
    updateSite(fromApiSite(updated));
    return updated;
  }, [ensurePersisted, removeDomain, updateSite]);

  const handleSelectSite = useCallback(
    (id: string) => {
      const next = sitesQuery.data?.find((s) => s.id === id);
      if (!next) return;
      updateSite(fromApiSite(next));
      setPersistedFlag(true);
    },
    [sitesQuery.data, updateSite, setPersistedFlag],
  );

  // Applying a template switches the site's templateId and seeds its palette
  // (accent + font); the renderer keys the whole look off templateId.
  const handleSelectTemplate = useCallback(
    (template: Template) => {
      const next: Site = {
        ...siteRef.current,
        templateId: template.id,
        settings: {
          ...siteRef.current.settings,
          accent: template.palette[1],
          font: template.font,
        },
      };
      handleUpdate(next);
      setActive("editor");
    },
    [handleUpdate],
  );

  const goEditor = () => setActive("editor");

  if (authLoading) {
    return <div className="auth-screen">Loading…</div>;
  }
  if (!user) {
    return <SignInScreen onSignIn={handleSignIn} />;
  }

  return (
    <div className="app-shell">
      <Sidebar active={active} onChange={setActive} user={user} onSignOut={handleSignOut} />
      <main className="main-content">
        {banner && (
          <div className={`conn-banner ${banner.kind}`}>
            <span>{banner.message}</span>
            <button className="banner-close" onClick={() => setBanner(null)}>
              ×
            </button>
          </div>
        )}
        <Header
          active={active}
          site={site}
          online={online}
          publishing={publishing}
          sites={sites}
          user={user}
          liveUrl={liveUrlFor(site)}
          onPublish={handlePublish}
          onSelectSite={handleSelectSite}
        />
        {active === "overview" && <Overview onEdit={goEditor} site={site} sites={sites} />}
        {active === "templates" && <Templates onSelect={handleSelectTemplate} />}
        {active === "leads" && <Leads site={site} online={online} onEdit={goEditor} />}
        {active === "editor" && (
          <Editor
            site={site}
            online={online}
            saveState={saveState}
            onUpdate={handleUpdate}
            onSetDomain={handleSetDomain}
            onVerifyDomain={handleVerifyDomain}
            onRemoveDomain={handleRemoveDomain}
          />
        )}
      </main>
    </div>
  );
}
