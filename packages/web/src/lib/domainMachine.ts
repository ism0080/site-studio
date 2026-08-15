import { assign, fromPromise, setup } from "xstate";

import type { DomainSetup, Site } from "../types.ts";
import { errorMessage } from "./api.ts";

/** Async domain operations the machine orchestrates (injected by the caller). */
export interface DomainApi {
  setDomain: (domain: string) => Promise<DomainSetup>;
  verifyDomain: () => Promise<Site>;
  removeDomain: () => Promise<Site>;
}

export type DomainMachineContext = {
  api: DomainApi;
  domain: string;
  setup: DomainSetup | null;
  error: string | null;
};

export type DomainMachineEvent =
  | { type: "INPUT"; domain: string }
  | { type: "CONNECT" }
  | { type: "VERIFY" }
  | { type: "REMOVE" };

const connectActor = fromPromise<DomainSetup, { api: DomainApi; domain: string }>(({ input }) =>
  input.api.setDomain(input.domain),
);

const verifyActor = fromPromise<Site, { api: DomainApi }>(({ input }) => input.api.verifyDomain());

const removeActor = fromPromise<Site, { api: DomainApi }>(({ input }) => input.api.removeDomain());

/** Custom-domain connection flow: connect -> DNS records -> verify -> active. */
export const domainMachine = setup({
  // SAFETY: The empty-object markers are xstate's documented typing idiom;
  // they only carry type-level info and are never read at runtime.
  types: {
    context: {} as DomainMachineContext,
    events: {} as DomainMachineEvent,
    input: {} as DomainApi,
  },
  actors: {
    connect: connectActor,
    verify: verifyActor,
    remove: removeActor,
  },
}).createMachine({
  context: ({ input }) => ({
    api: input,
    domain: "",
    setup: null,
    error: null,
  }),
  initial: "idle",
  states: {
    idle: {
      on: {
        INPUT: {
          actions: assign({ domain: ({ event }) => event.domain }),
        },
        CONNECT: {
          target: "connecting",
          guard: ({ context }) => context.domain.trim().length > 0,
          actions: assign({ error: null }),
        },
        REMOVE: {
          target: "removing",
          actions: assign({ error: null }),
        },
      },
    },
    connecting: {
      entry: assign({ error: null }),
      invoke: {
        src: "connect",
        input: ({ context }) => ({
          api: context.api,
          domain: context.domain.trim(),
        }),
        onDone: {
          target: "pending",
          actions: assign({ setup: ({ event }) => event.output }),
        },
        onError: {
          target: "idle",
          actions: assign({ error: ({ event }) => errorMessage(event.error) }),
        },
      },
    },
    pending: {
      on: {
        VERIFY: {
          target: "verifying",
          actions: assign({ error: null }),
        },
      },
    },
    verifying: {
      entry: assign({ error: null }),
      invoke: {
        src: "verify",
        input: ({ context }) => ({ api: context.api }),
        onDone: {
          target: "idle",
          actions: assign({ setup: null, domain: "" }),
        },
        onError: {
          target: "pending",
          actions: assign({ error: ({ event }) => errorMessage(event.error) }),
        },
      },
    },
    removing: {
      entry: assign({ error: null }),
      invoke: {
        src: "remove",
        input: ({ context }) => ({ api: context.api }),
        onDone: {
          target: "idle",
          actions: assign({ setup: null, domain: "" }),
        },
        onError: {
          target: "idle",
          actions: assign({ error: ({ event }) => errorMessage(event.error) }),
        },
      },
    },
  },
});
