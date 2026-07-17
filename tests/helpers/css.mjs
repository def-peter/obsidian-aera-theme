import postcss from "postcss";

const allowedThemeSelectors = new Set([
  ".theme-light",
  ".theme-dark",
  "body",
  ".callout",
  ".callout-title",
  ".callout-content",
  ".callout-icon",
  ".callout-icon svg",
  ".callout-fold",
  ".callout.is-collapsed .callout-icon",
  ":where(.markdown-rendered pre:not(.frontmatter))",
  ":where(.markdown-rendered pre:not(.frontmatter)) code[class*=language-]",
  ":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock)",
  ".markdown-rendered blockquote",
  ".markdown-rendered blockquote:not(blockquote blockquote)::before",
  ".markdown-rendered blockquote:not(blockquote blockquote)::after",
  ".markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote)",
  ".markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote)::before",
  ".markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote)::after",
  ".markdown-source-view.mod-cm6:not(.is-live-preview) .HyperMD-quote",
]);
const officialCalloutTypeVariables = new Set([
  "--callout-bug",
  "--callout-default",
  "--callout-error",
  "--callout-example",
  "--callout-fail",
  "--callout-important",
  "--callout-info",
  "--callout-question",
  "--callout-success",
  "--callout-summary",
  "--callout-tip",
  "--callout-todo",
  "--callout-warning",
  "--callout-quote",
]);

export function declarationsFor(css, selector) {
  const declarations = new Map();
  const root = postcss.parse(css);

  root.walkRules((rule) => {
    if (rule.selector !== selector) return;

    for (const node of rule.nodes ?? []) {
      if (node.type === "decl") declarations.set(node.prop, node.value);
    }
  });

  return declarations;
}

export function selectorsFor(css) {
  const selectors = new Set();

  postcss.parse(css).walkRules((rule) => selectors.add(rule.selector));

  return selectors;
}

export function assertThemeStructure(css) {
  const root = postcss.parse(css);

  root.walkDecls((declaration) => {
    if (officialCalloutTypeVariables.has(declaration.prop)) {
      throw new Error(
        `${declaration.prop} is a forbidden semantic type variable`,
      );
    }

    if (!declaration.prop.startsWith("--callout-")) return;

    const selector =
      declaration.parent?.type === "rule"
        ? declaration.parent.selector
        : "a non-rule context";
    if (selector !== "body") {
      throw new Error(
        `${declaration.prop} must be declared only on body; found ${selector}`,
      );
    }
  });

  const selectors = new Set();
  root.walkRules((rule) => selectors.add(rule.selector));
  const unexpected = [...selectors].filter(
    (selector) => !allowedThemeSelectors.has(selector),
  );
  const missing = [...allowedThemeSelectors].filter(
    (selector) => !selectors.has(selector),
  );

  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `unexpected theme selector set: unexpected [${unexpected.join(", ")}], missing [${missing.join(", ")}]`,
    );
  }
}
