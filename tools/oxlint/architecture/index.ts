import { eslintCompatPlugin } from "@oxlint/plugins";

import noApiBackendImportsRule from "./rules/no-api-backend-imports.ts";
import noApiRepositoryImportsRule from "./rules/no-api-repository-imports.ts";

/** Architecture Oxlint rules that enforce package and layer boundaries. */
const architecturePlugin = eslintCompatPlugin({
  meta: { name: "architecture" },
  rules: {
    "no-api-backend-imports": noApiBackendImportsRule,
    "no-api-repository-imports": noApiRepositoryImportsRule,
  },
});

export default architecturePlugin;
