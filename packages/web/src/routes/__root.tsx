import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import type { RouterContext } from "../router.ts";
import { RouteError, RouteNotFound } from "../components/RouteState.tsx";
import { useWorkspace } from "../lib/workspaceContext.ts";
import "../components/SignInScreen.css";
import { XIcon } from "@phosphor-icons/react";

export const Route = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  errorComponent: RouteError,
  notFoundComponent: RouteNotFound,
});

function AppShell() {
  const workspace = useWorkspace();

  if (workspace.authLoading) {
    return <div data-component="sign-in">Loading…</div>;
  }
  if (!workspace.user) {
    return <SignIn onSignIn={workspace.signIn} />;
  }

  return (
    <>
      {workspace.banner && (
        <div data-component="banner" data-kind={workspace.banner.kind}>
          <span>{workspace.banner.message}</span>
          <button data-slot="close" onClick={workspace.dismissBanner}>
            <XIcon size={16} />
          </button>
        </div>
      )}
      <Outlet />
    </>
  );
}

function SignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div data-component="sign-in">
      <div data-slot="card">
        <h1>Welcome back</h1>
        <p>Sign in to build and publish your site.</p>
        <button className="dark-button" data-slot="google-button" onClick={onSignIn}>
          <span data-slot="google-mark">G</span> Continue with Google
        </button>
      </div>
    </div>
  );
}
