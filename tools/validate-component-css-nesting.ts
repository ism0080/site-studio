import { Glob } from "bun";

const componentCssFiles = [
  ...new Glob("packages/web/src/components/*.css").scanSync(),
  ...new Glob("packages/web/src/styles/component/*.css").scanSync(),
];

const rootSelector = /^\[data-component=(?:"[^"]+"|'[^']+')\]$/;
const rawColorPattern = /#[\da-f]{3,8}\b/gi;
const rawFontFamilyPattern = /(?:font-family|font)\s*:[^;]*(?:"|')/gi;
const rawSpacingPattern = /(?:margin|padding|gap)\s*:[^;]*(?:\d+(?:\.\d+)?(?:px|rem))/gi;
const isComponentRootSelector = (selector: string) =>
  selector
    .split(",")
    .map((part) => part.trim())
    .every((part) => rootSelector.test(part));

const topLevelRuleSelectors = (css: string) => {
  const selectors: Array<{ selector: string; position: number }> = [];
  let depth = 0;
  let selectorStart = 0;
  let inComment = false;
  let quote: '"' | "'" | undefined;

  for (let position = 0; position < css.length; position += 1) {
    const character = css[position];
    const nextCharacter = css[position + 1];

    if (inComment) {
      if (character === "*" && nextCharacter === "/") {
        inComment = false;
        position += 1;
      }
      continue;
    }

    if (quote !== undefined) {
      if (character === "\\") {
        position += 1;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      inComment = true;
      position += 1;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "{") {
      if (depth === 0) {
        selectors.push({
          selector: css.slice(selectorStart, position).trim(),
          position: selectorStart,
        });
      }
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) selectorStart = position + 1;
    }
  }

  return selectors;
};

const violations: Array<string> = [];
const lineNumberAt = ({ css, position }: { css: string; position: number }) =>
  css.slice(0, position).split("\n").length;
const tokenViolation = ({ file, line, message }: { file: string; line: number; message: string }) =>
  violations.push(`${file}:${line}: ${message}`);

for (const file of componentCssFiles) {
  const css = await Bun.file(file).text();
  if (!css.includes("[data-component=")) continue;

  for (const { selector, position } of topLevelRuleSelectors(css)) {
    if (isComponentRootSelector(selector) || selector.startsWith("@")) {
      continue;
    }

    tokenViolation({
      file,
      line: lineNumberAt({ css, position }),
      message: 'Component CSS must be nested under a [data-component="..."] root.',
    });
  }

  for (const match of css.matchAll(rawColorPattern)) {
    tokenViolation({
      file,
      line: lineNumberAt({ css, position: match.index }),
      message: "Raw color values are banned. Add or use a --color token.",
    });
  }

  for (const match of css.matchAll(rawFontFamilyPattern)) {
    tokenViolation({
      file,
      line: lineNumberAt({ css, position: match.index }),
      message: "Raw font families are banned. Use a --font token.",
    });
  }

  for (const match of css.matchAll(rawSpacingPattern)) {
    tokenViolation({
      file,
      line: lineNumberAt({ css, position: match.index }),
      message: "Raw spacing values are banned. Use a --space token.",
    });
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}
