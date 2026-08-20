import { eslintCompatPlugin } from "@oxlint/plugins";

import noInlineStylesRule from "./rules/no-inline-styles.ts";
import noReactComponentInnerFunctionsRule from "./rules/no-react-component-inner-functions.ts";
import noReactNonComponentFunctionExportsRule from "./rules/no-react-non-component-function-exports.ts";
import noReactStateHooksRule from "./rules/no-react-state-hooks.ts";

/** React-specific Oxlint rules that keep components pure and behavior in XState actors. */
const reactPlugin = eslintCompatPlugin({
  meta: { name: "react-ui" },
  rules: {
    "no-inline-styles": noInlineStylesRule,
    "no-react-component-inner-functions": noReactComponentInnerFunctionsRule,
    "no-react-non-component-function-exports": noReactNonComponentFunctionExportsRule,
    "no-react-state-hooks": noReactStateHooksRule,
  },
});

export default reactPlugin;
