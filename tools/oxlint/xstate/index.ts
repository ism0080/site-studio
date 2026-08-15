import { eslintCompatPlugin } from "@oxlint/plugins";

import noDirectXstateCreateMachineRule from "./rules/no-direct-xstate-create-machine.ts";
import noDirectXstateUseSelectorRule from "./rules/no-direct-xstate-use-selector.ts";
import noMultipleXstateHooksRule from "./rules/no-multiple-xstate-hooks.ts";
import noSingleUseXstateActionsRule from "./rules/no-single-use-xstate-actions.ts";
import noSingleUseXstateGuardsRule from "./rules/no-single-use-xstate-guards.ts";
import requireXstateEventSatisfiesRule from "./rules/require-xstate-event-satisfies.ts";

/** XState-specific Oxlint rules that enforce setup()-first machines and typed event flows. */
const xstatePlugin = eslintCompatPlugin({
  meta: { name: "xstate" },
  rules: {
    "no-direct-xstate-create-machine": noDirectXstateCreateMachineRule,
    "no-direct-xstate-use-selector": noDirectXstateUseSelectorRule,
    "no-multiple-xstate-hooks": noMultipleXstateHooksRule,
    "no-single-use-xstate-actions": noSingleUseXstateActionsRule,
    "no-single-use-xstate-guards": noSingleUseXstateGuardsRule,
    "require-xstate-event-satisfies": requireXstateEventSatisfiesRule,
  },
});

export default xstatePlugin;
