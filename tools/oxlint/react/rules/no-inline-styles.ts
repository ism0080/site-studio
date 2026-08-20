import type { RuleTester } from "oxlint/plugins-dev";

type Rule = Parameters<RuleTester["run"]>[1];

const rule: Rule = {
  meta: {
    type: "problem" as const,
    docs: {
      description:
        "Keep component presentation in CSS files using data-component and data-slot selectors.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "style") {
          return;
        }

        context.report({
          node,
          message:
            "Inline styles are banned. Define the presentation in a CSS file using data-component and data-slot selectors.",
        });
      },
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "style") {
          return;
        }

        context.report({
          node,
          message:
            "Style elements are banned. Define the presentation in a CSS file using data-component and data-slot selectors.",
        });
      },
    };
  },
};

export default rule;
