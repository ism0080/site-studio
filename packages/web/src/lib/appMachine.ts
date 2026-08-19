import { assign, fromPromise, setup } from "xstate";

import type { User } from "better-auth";
import type {
  Agency,
  CreateSitePayload,
  DomainSetup,
  Member,
  MemberInput,
  PublishResult,
  SaveState,
  Site,
  Template,
} from "../siteTypes.ts";
import { fromApiSite, toApiSite } from "./siteApi.ts";
import { readableErrorMessage } from "./formatting.ts";
import { initialSite } from "../data/site.ts";

/** App-shell operations the machine orchestrates (injected by the caller). */
export interface AppApi {
  getSession: () => Promise<{ user: User | null }>;
  signIn: () => void;
  signOut: () => Promise<void>;
  createSite: (payload: CreateSitePayload) => Promise<Site>;
  updateSite: (site: Site) => Promise<Site>;
  publishSite: (id: string) => Promise<PublishResult>;
  fetchSite: (id: string) => Promise<Site>;
  setDomain: (id: string, domain: string) => Promise<DomainSetup>;
  verifyDomain: (id: string) => Promise<Site>;
  removeDomain: (id: string) => Promise<Site>;
  inviteMember: (siteId: string, input: MemberInput) => Promise<Member>;
  inviteAgency: (email: string) => Promise<Agency>;
}

/** Top-of-app alert banner (error or success) with the message to show. */
export type AppBanner = { kind: "error" | "success"; message: string };

/** Invite permission toggles (edit / publish / leads) for a site member. */
export type AccessToggles = { canEdit: boolean; canPublish: boolean; canLeads: boolean };

export type AppMachineContext = {
  api: AppApi;
  user: User | null;
  authLoading: boolean;
  site: Site;
  persisted: boolean;
  saveState: SaveState;
  publishing: boolean;
  banner: AppBanner | null;
  domain: string;
  setup: DomainSetup | null;
  domainError: string | null;
  accessEmail: string;
  accessToggles: AccessToggles;
  accessError: string | null;
  adminEmail: string;
  adminError: string | null;
};

export type AppMachineEvent =
  | { type: "SIGN_IN" }
  | { type: "SIGN_OUT" }
  | { type: "LOAD_SITE"; id: string }
  | { type: "UPDATE"; site: Site }
  | { type: "SELECT_TEMPLATE"; template: Template }
  | { type: "PUBLISH" }
  | { type: "DISMISS_BANNER" }
  | { type: "DOMAIN_INPUT"; domain: string }
  | { type: "DOMAIN_CONNECT" }
  | { type: "DOMAIN_VERIFY" }
  | { type: "DOMAIN_REMOVE" }
  | { type: "ACCESS_EMAIL_INPUT"; email: string }
  | { type: "ACCESS_TOGGLE"; key: keyof AccessToggles }
  | { type: "ACCESS_INVITE" }
  | { type: "ADMIN_EMAIL_INPUT"; email: string }
  | { type: "ADMIN_INVITE" };

const _noToggles = (): AccessToggles => ({ canEdit: false, canPublish: false, canLeads: false });

const _sessionActor = fromPromise<{ user: User | null }, { api: AppApi }>(({ input }) =>
  input.api.getSession(),
);

const _loadSiteActor = fromPromise<Site, { api: AppApi; id: string }>(({ input }) =>
  input.api.fetchSite(input.id),
);

const _ensurePersisted = async (api: AppApi, site: Site, persisted: boolean) => {
  if (persisted) {
    return { id: site.id, site, persisted: true };
  }
  const created = await api.createSite({
    name: site.business.name,
    templateId: site.templateId,
  });
  return { id: created.id, site: created, persisted: true };
};

type PersistInput = { api: AppApi; site: Site; persisted: boolean };
type SiteOutput = { site: Site; persisted: boolean };

const _saveActor = fromPromise<{ persisted: boolean; created: Site | null }, PersistInput>(
  async ({ input }) => {
    if (input.persisted) {
      await input.api.updateSite(toApiSite(input.site));
      return { persisted: true, created: null };
    }
    const created = await input.api.createSite({
      name: input.site.business.name,
      templateId: input.site.templateId,
    });
    return { persisted: true, created };
  },
);

const _publishActor = fromPromise<SiteOutput, PersistInput>(async ({ input }) => {
  const ensured = await _ensurePersisted(input.api, input.site, input.persisted);
  await input.api.publishSite(ensured.id);
  // The static build runs asynchronously in the background; poll until it
  // settles so the publish flow reports the real outcome (up to ~3 min).
  let site = await input.api.fetchSite(ensured.id);
  for (let attempts = 0; attempts < 36 && site.buildStatus === "building"; attempts += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    site = await input.api.fetchSite(ensured.id);
  }
  return { site, persisted: true };
});

const _domainConnectActor = fromPromise<
  { setup: DomainSetup; site: Site; persisted: boolean },
  PersistInput & { domain: string }
>(async ({ input }) => {
  const ensured = await _ensurePersisted(input.api, input.site, input.persisted);
  const domainSetup = await input.api.setDomain(ensured.id, input.domain);
  return { setup: domainSetup, site: ensured.site, persisted: true };
});

const _domainVerifyActor = fromPromise<SiteOutput, PersistInput>(async ({ input }) => {
  const ensured = await _ensurePersisted(input.api, input.site, input.persisted);
  const updated = await input.api.verifyDomain(ensured.id);
  return { site: updated, persisted: true };
});

const _domainRemoveActor = fromPromise<SiteOutput, PersistInput>(async ({ input }) => {
  const ensured = await _ensurePersisted(input.api, input.site, input.persisted);
  const updated = await input.api.removeDomain(ensured.id);
  return { site: updated, persisted: true };
});

const _accessInviteActor = fromPromise<
  void,
  { api: AppApi; siteId: string; email: string; toggles: AccessToggles }
>(async ({ input }) => {
  await input.api.inviteMember(input.siteId, {
    email: input.email,
    ...input.toggles,
  });
});

const _adminInviteActor = fromPromise<void, { api: AppApi; email: string }>(async ({ input }) => {
  await input.api.inviteAgency(input.email);
});

const _applyTemplate = (site: Site, template: Template): Site => ({
  ...site,
  templateId: template.id,
  settings: {
    ...site.settings,
    accent: template.theme.accent,
    font: template.font,
  },
});

const _bannerFor = (kind: AppBanner["kind"], message: string): AppBanner => ({ kind, message });

/** App-shell state: auth, sites, editor save/publish, and custom-domain flow. */
export const appMachine = setup({
  // SAFETY: The empty-object markers are xstate's documented typing idiom;
  // they only carry type-level info and are never read at runtime.
  types: {
    context: {} as AppMachineContext,
    events: {} as AppMachineEvent,
    input: {} as AppApi,
  },
  actors: {
    session: _sessionActor,
    loadSite: _loadSiteActor,
    save: _saveActor,
    publish: _publishActor,
    domainConnect: _domainConnectActor,
    domainVerify: _domainVerifyActor,
    domainRemove: _domainRemoveActor,
    accessInvite: _accessInviteActor,
    adminInvite: _adminInviteActor,
  },
}).createMachine({
  context: ({ input }): AppMachineContext => ({
    api: input,
    user: null,
    authLoading: true,
    site: initialSite,
    persisted: false,
    saveState: "idle",
    publishing: false,
    banner: null,
    domain: "",
    setup: null,
    domainError: null,
    accessEmail: "",
    accessToggles: _noToggles(),
    accessError: null,
    adminEmail: "",
    adminError: null,
  }),
  initial: "checking",
  states: {
    checking: {
      invoke: {
        src: "session",
        input: ({ context }) => ({ api: context.api }),
        onDone: [
          {
            guard: ({ event }) => event.output.user !== null,
            target: "ready",
            actions: assign({
              user: ({ event }) => event.output.user,
              authLoading: false,
            }),
          },
          {
            target: "signedOut",
            actions: assign({ user: null, authLoading: false }),
          },
        ],
        onError: {
          target: "signedOut",
          actions: assign({ authLoading: false }),
        },
      },
    },
    signedOut: {
      on: {
        SIGN_IN: {
          actions: ({ context }) => {
            context.api.signIn();
          },
        },
      },
    },
    ready: {
      type: "parallel",
      on: {
        SIGN_OUT: {
          actions: ({ context }) => {
            void context.api.signOut();
          },
        },
        DISMISS_BANNER: {
          actions: assign({ banner: null }),
        },
      },
      states: {
        // The router owns the selected site id; this state swaps the editor's
        // working copy whenever the URL's $siteId changes.
        siteLoad: {
          initial: "idle",
          states: {
            idle: {
              on: {
                LOAD_SITE: {
                  target: "loading",
                },
              },
            },
            loading: {
              invoke: {
                src: "loadSite",
                input: ({ context, event }) => {
                  // Only LOAD_SITE transitions into loading, so the id is present here.
                  const id = event.type === "LOAD_SITE" ? event.id : context.site.id;
                  return { api: context.api, id };
                },
                onDone: {
                  target: "idle",
                  actions: assign({
                    site: ({ event }) => event.output,
                    persisted: true,
                    saveState: "idle",
                  }),
                },
                onError: {
                  target: "idle",
                  actions: assign({
                    banner: ({ event }) =>
                      _bannerFor(
                        "error",
                        `Couldn't load site: ${readableErrorMessage(event.error)}`,
                      ),
                  }),
                },
              },
            },
          },
        },
        editor: {
          initial: "idle",
          states: {
            idle: {
              on: {
                UPDATE: {
                  target: "dirty",
                  actions: assign({ site: ({ event }) => event.site }),
                },
                SELECT_TEMPLATE: {
                  target: "dirty",
                  actions: assign({
                    site: ({ context, event }) => _applyTemplate(context.site, event.template),
                  }),
                },
                PUBLISH: {
                  target: "publishing",
                  actions: assign({ publishing: true }),
                },
              },
            },
            dirty: {
              on: {
                UPDATE: {
                  target: "dirty",
                  actions: assign({ site: ({ event }) => event.site }),
                },
                SELECT_TEMPLATE: {
                  target: "dirty",
                  actions: assign({
                    site: ({ context, event }) => _applyTemplate(context.site, event.template),
                  }),
                },
                PUBLISH: {
                  target: "publishing",
                  actions: assign({ publishing: true }),
                },
              },
              after: {
                800: {
                  target: "saving",
                  actions: assign({ saveState: "saving" }),
                },
              },
            },
            saving: {
              invoke: {
                src: "save",
                input: ({ context }) => ({
                  api: context.api,
                  site: context.site,
                  persisted: context.persisted,
                }),
                onDone: {
                  target: "idle",
                  actions: assign({
                    saveState: "saved",
                    persisted: ({ event }) => event.output.persisted,
                    site: ({ context, event }) =>
                      event.output.created === null
                        ? context.site
                        : fromApiSite(event.output.created),
                  }),
                },
                onError: {
                  target: "idle",
                  actions: assign({
                    saveState: "error",
                    banner: ({ event }) =>
                      _bannerFor("error", `Save failed: ${readableErrorMessage(event.error)}`),
                  }),
                },
              },
            },
            publishing: {
              invoke: {
                src: "publish",
                input: ({ context }) => ({
                  api: context.api,
                  site: context.site,
                  persisted: context.persisted,
                }),
                onDone: {
                  target: "idle",
                  actions: assign({
                    publishing: false,
                    site: ({ event }) => fromApiSite(event.output.site),
                    persisted: true,
                    banner: ({ event }) => {
                      const build = event.output.site.buildStatus;
                      if (build === "built") {
                        return _bannerFor("success", "Published. Your site is live.");
                      }
                      if (build === "failed") {
                        return _bannerFor(
                          "error",
                          `Published, but the build failed${
                            event.output.site.buildError ? `: ${event.output.site.buildError}` : ""
                          }`,
                        );
                      }
                      return _bannerFor(
                        "success",
                        "Published. The build is still running — your site will go live shortly.",
                      );
                    },
                  }),
                },
                onError: {
                  target: "idle",
                  actions: assign({
                    publishing: false,
                    banner: ({ event }) =>
                      _bannerFor("error", `Publish failed: ${readableErrorMessage(event.error)}`),
                  }),
                },
              },
            },
          },
        },
        domain: {
          initial: "idle",
          states: {
            idle: {
              on: {
                DOMAIN_INPUT: {
                  actions: assign({ domain: ({ event }) => event.domain }),
                },
                DOMAIN_CONNECT: {
                  target: "connecting",
                  guard: ({ context }) => context.domain.trim().length > 0,
                  actions: assign({ domainError: null }),
                },
                DOMAIN_REMOVE: {
                  target: "removing",
                  actions: assign({ domainError: null }),
                },
              },
            },
            connecting: {
              entry: assign({ domainError: null }),
              invoke: {
                src: "domainConnect",
                input: ({ context }) => ({
                  api: context.api,
                  site: context.site,
                  persisted: context.persisted,
                  domain: context.domain.trim(),
                }),
                onDone: {
                  target: "pending",
                  actions: assign({
                    setup: ({ event }) => event.output.setup,
                    site: ({ event }) => fromApiSite(event.output.site),
                    persisted: true,
                  }),
                },
                onError: {
                  target: "idle",
                  actions: assign({
                    domainError: ({ event }) => readableErrorMessage(event.error),
                  }),
                },
              },
            },
            pending: {
              on: {
                DOMAIN_VERIFY: {
                  target: "verifying",
                  actions: assign({ domainError: null }),
                },
              },
            },
            verifying: {
              entry: assign({ domainError: null }),
              invoke: {
                src: "domainVerify",
                input: ({ context }) => ({
                  api: context.api,
                  site: context.site,
                  persisted: context.persisted,
                }),
                onDone: {
                  target: "idle",
                  actions: assign({
                    setup: null,
                    domain: "",
                    site: ({ event }) => fromApiSite(event.output.site),
                    persisted: true,
                  }),
                },
                onError: {
                  target: "pending",
                  actions: assign({
                    domainError: ({ event }) => readableErrorMessage(event.error),
                  }),
                },
              },
            },
            removing: {
              entry: assign({ domainError: null }),
              invoke: {
                src: "domainRemove",
                input: ({ context }) => ({
                  api: context.api,
                  site: context.site,
                  persisted: context.persisted,
                }),
                onDone: {
                  target: "idle",
                  actions: assign({
                    setup: null,
                    domain: "",
                    site: ({ event }) => fromApiSite(event.output.site),
                    persisted: true,
                  }),
                },
                onError: {
                  target: "idle",
                  actions: assign({
                    domainError: ({ event }) => readableErrorMessage(event.error),
                  }),
                },
              },
            },
          },
        },
        access: {
          initial: "idle",
          states: {
            idle: {
              on: {
                ACCESS_EMAIL_INPUT: {
                  actions: assign({ accessEmail: ({ event }) => event.email }),
                },
                ACCESS_TOGGLE: {
                  actions: assign({
                    accessToggles: ({ context, event }) => ({
                      ...context.accessToggles,
                      [event.key]: !context.accessToggles[event.key],
                    }),
                  }),
                },
                ACCESS_INVITE: {
                  target: "inviting",
                  guard: ({ context }) => context.accessEmail.trim().length > 0,
                  actions: assign({ accessError: null }),
                },
              },
            },
            inviting: {
              invoke: {
                src: "accessInvite",
                input: ({ context }) => ({
                  api: context.api,
                  siteId: context.site.id,
                  email: context.accessEmail.trim(),
                  toggles: context.accessToggles,
                }),
                onDone: {
                  target: "idle",
                  actions: assign({
                    accessEmail: "",
                    accessToggles: _noToggles(),
                  }),
                },
                onError: {
                  target: "idle",
                  actions: assign({
                    accessError: ({ event }) => readableErrorMessage(event.error),
                  }),
                },
              },
            },
          },
        },
        admin: {
          initial: "idle",
          states: {
            idle: {
              on: {
                ADMIN_EMAIL_INPUT: {
                  actions: assign({ adminEmail: ({ event }) => event.email }),
                },
                ADMIN_INVITE: {
                  target: "inviting",
                  guard: ({ context }) => context.adminEmail.trim().length > 0,
                  actions: assign({ adminError: null }),
                },
              },
            },
            inviting: {
              invoke: {
                src: "adminInvite",
                input: ({ context }) => ({
                  api: context.api,
                  email: context.adminEmail.trim(),
                }),
                onDone: {
                  target: "idle",
                  actions: assign({ adminEmail: "" }),
                },
                onError: {
                  target: "idle",
                  actions: assign({
                    adminError: ({ event }) => readableErrorMessage(event.error),
                  }),
                },
              },
            },
          },
        },
      },
    },
  },
});
