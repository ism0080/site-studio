import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Header from "./components/Header.jsx";
import Overview from "./components/Overview.jsx";
import Templates from "./components/Templates.jsx";
import Leads from "./components/Leads.jsx";
import EditorPanel from "./components/EditorPanel.jsx";
import Preview from "./components/Preview.jsx";
import { initialSite } from "./data/site.js";
import { api, fromApiSite, liveUrlFor, toApiSite } from "./lib/api.js";
import { authClient } from "./lib/auth.js";

function SignInScreen({ onSignIn }) {
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
}) {
  const [device, setDevice] = useState("desktop");
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
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [active, setActive] = useState("overview");
  const [sites, setSites] = useState([]);
  const [site, setSite] = useState(initialSite);
  const [persisted, setPersisted] = useState(false);
  const [online, setOnline] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [publishing, setPublishing] = useState(false);
  const [banner, setBanner] = useState(null);

  const siteRef = useRef(site);
  const persistedRef = useRef(persisted);
  const saveTimer = useRef(null);

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

  const updateSite = useCallback((next) => {
    siteRef.current = next;
    setSite(next);
  }, []);

  const setPersistedFlag = useCallback((value) => {
    persistedRef.current = value;
    setPersisted(value);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const list = await api.listSites();
      setSites(list);
      setOnline(true);
      if (list.length > 0) {
        updateSite(fromApiSite(list[0]));
        setPersistedFlag(true);
      }
    } catch {
      setOnline(false);
      setBanner({
        kind: "error",
        message: "API unreachable — showing local demo data. Start the API and reload to go live.",
      });
    }
  }, [user, updateSite, setPersistedFlag]);

  useEffect(() => {
    load();
  }, [load]);

  // Persist the current site to the API (create on first save, then update).
  const commit = useCallback(
    async (next) => {
      setSaveState("saving");
      try {
        if (persistedRef.current) {
          await api.updateSite(next.id, toApiSite(next));
        } else {
          const created = await api.createSite({
            name: next.business.name,
            templateId: next.templateId,
          });
          updateSite(fromApiSite(created));
          setPersistedFlag(true);
        }
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        setBanner({ kind: "error", message: `Save failed: ${e.message}` });
      }
    },
    [updateSite, setPersistedFlag],
  );

  const handleUpdate = useCallback(
    (next) => {
      updateSite(next);
      if (online !== true) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => commit(next), 800);
    },
    [updateSite, online, commit],
  );

  // Returns a persisted site id, creating the site if the demo site was never saved.
  const ensurePersisted = useCallback(async () => {
    if (persistedRef.current) return siteRef.current.id;
    const created = await api.createSite({
      name: siteRef.current.business.name,
      templateId: siteRef.current.templateId,
    });
    updateSite(fromApiSite(created));
    setPersistedFlag(true);
    setSites((list) => (list.some((s) => s.id === created.id) ? list : [...list, created]));
    return created.id;
  }, [updateSite, setPersistedFlag]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setBanner(null);
    try {
      const id = await ensurePersisted();
      await api.publishSite(id);
      const updated = await api.getSite(id);
      updateSite(fromApiSite(updated));
      setBanner({
        kind: "success",
        message:
          "Published. Static HTML is generated by the Astro build step (run `bun run publish` in packages/site-template).",
      });
    } catch (e) {
      setBanner({ kind: "error", message: `Publish failed: ${e.message}` });
    } finally {
      setPublishing(false);
    }
  }, [ensurePersisted, updateSite]);

  const handleSetDomain = useCallback(
    async (domain) => {
      const id = await ensurePersisted();
      const setup = await api.setDomain(id, domain);
      return setup;
    },
    [ensurePersisted],
  );

  const handleVerifyDomain = useCallback(async () => {
    const id = await ensurePersisted();
    const updated = await api.verifyDomain(id);
    updateSite(fromApiSite(updated));
    return updated;
  }, [ensurePersisted, updateSite]);

  const handleRemoveDomain = useCallback(async () => {
    const id = await ensurePersisted();
    const updated = await api.removeDomain(id);
    updateSite(fromApiSite(updated));
    return updated;
  }, [ensurePersisted, updateSite]);

  const handleSelectSite = useCallback(
    (id) => {
      const next = sites.find((s) => s.id === id);
      if (!next) return;
      updateSite(fromApiSite(next));
      setPersistedFlag(true);
    },
    [sites, updateSite, setPersistedFlag],
  );

  // Applying a template switches the site's templateId and seeds its palette
  // (accent + font); the renderer keys the whole look off templateId.
  const handleSelectTemplate = useCallback(
    (template) => {
      const next = {
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
          saveState={saveState}
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
            onPublish={handlePublish}
            onSetDomain={handleSetDomain}
            onVerifyDomain={handleVerifyDomain}
            onRemoveDomain={handleRemoveDomain}
          />
        )}
      </main>
    </div>
  );
}
