import { useMemo, type ReactNode } from "react";
import { useMachine } from "@xstate/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { appMachine } from "./appMachine.ts";
import { authClient } from "./auth.ts";
import { setSiteLoadHandler } from "./routerBridge.ts";
import { WorkspaceContext, type WorkspaceValue } from "./workspaceContext.ts";
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
} from "./apiQueries.ts";

/** Provides the app machine, auth, permission model, and site mutations. */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
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
      signIn: () =>
        authClient.signIn.social({ provider: "google", callbackURL: window.location.href }),
      signOut: async () => {
        await authClient.signOut();
        window.location.reload();
      },
      fetchSite: (id) => queryClient.fetchQuery(siteQueries.detail(id)),
      createSite: (payload) => createSite.mutateAsync(payload),
      updateSite: (site) => updateSiteMutation.mutateAsync(site),
      publishSite: (id) => publishSite.mutateAsync(id),
      setDomain: (id, domain) => setDomain.mutateAsync({ id, domain }),
      verifyDomain: (id) => verifyDomain.mutateAsync(id),
      removeDomain: (id) => removeDomain.mutateAsync(id),
      inviteMember: (siteId, input) => inviteMember.mutateAsync({ siteId, input }),
      inviteAgency: (email) => inviteAgency.mutateAsync(email),
    },
  });

  const { data: me } = useQuery({ ...meQueries.me(), enabled: snapshot.context.user !== null });
  const { data: access } = useQuery({
    ...accessQueries.detail(snapshot.context.site.id),
    enabled: snapshot.context.user !== null,
  });

  const role = me?.role;
  const isFull = access === undefined || access.kind === "full";
  const canEdit = isFull || (access?.kind === "client" && access.canEdit);
  const canPublish = isFull || (access?.kind === "client" && access.canPublish);
  const canLeads = isFull || (access?.kind === "client" && access.canLeads);
  const canManageMembers = (role === "admin" || role === "agency") && isFull;

  const domainBusy =
    snapshot.matches({ ready: { domain: "connecting" } }) ||
    snapshot.matches({ ready: { domain: "verifying" } }) ||
    snapshot.matches({ ready: { domain: "removing" } });
  const accessBusy = snapshot.matches({ ready: { access: "inviting" } });
  const adminBusy = snapshot.matches({ ready: { admin: "inviting" } });

  // `send` from useMachine is stable across renders, so the handler stays put.
  setSiteLoadHandler((id) => send({ type: "LOAD_SITE", id }));

  const value = useMemo<WorkspaceValue>(
    () => ({
      user: snapshot.context.user,
      authLoading: snapshot.context.authLoading,
      site: snapshot.context.site,
      persisted: snapshot.context.persisted,
      saveState: snapshot.context.saveState,
      publishing: snapshot.context.publishing,
      banner: snapshot.context.banner,
      domain: snapshot.context.domain,
      setup: snapshot.context.setup,
      domainError: snapshot.context.domainError,
      domainBusy,
      accessEmail: snapshot.context.accessEmail,
      accessToggles: snapshot.context.accessToggles,
      accessBusy,
      accessError: snapshot.context.accessError,
      adminEmail: snapshot.context.adminEmail,
      adminBusy,
      adminError: snapshot.context.adminError,
      meRole: role,
      isFull,
      canEdit,
      canPublish,
      canLeads,
      canManageMembers,
      isAdmin: role === "admin",
      loadSite: (id) => send({ type: "LOAD_SITE", id }),
      signIn: () => send({ type: "SIGN_IN" }),
      signOut: () => send({ type: "SIGN_OUT" }),
      dismissBanner: () => send({ type: "DISMISS_BANNER" }),
      updateSite: (site) => send({ type: "UPDATE", site }),
      selectTemplate: (template) => send({ type: "SELECT_TEMPLATE", template }),
      publish: () => send({ type: "PUBLISH" }),
      domainInput: (domain) => send({ type: "DOMAIN_INPUT", domain }),
      domainConnect: () => send({ type: "DOMAIN_CONNECT" }),
      domainVerify: () => send({ type: "DOMAIN_VERIFY" }),
      domainRemove: () => send({ type: "DOMAIN_REMOVE" }),
      accessEmailInput: (email) => send({ type: "ACCESS_EMAIL_INPUT", email }),
      accessToggle: (key) => send({ type: "ACCESS_TOGGLE", key }),
      accessInvite: () => send({ type: "ACCESS_INVITE" }),
      adminEmailInput: (email) => send({ type: "ADMIN_EMAIL_INPUT", email }),
      adminInvite: () => send({ type: "ADMIN_INVITE" }),
    }),
    [
      snapshot,
      send,
      role,
      isFull,
      canEdit,
      canPublish,
      canLeads,
      canManageMembers,
      domainBusy,
      accessBusy,
      adminBusy,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
