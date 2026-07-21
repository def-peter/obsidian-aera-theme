import postcss from "postcss";

export const calloutTypeSelectors = [
  ":where(.callout[data-callout=note])",
  ":where(.callout[data-callout=abstract],\n.callout[data-callout=summary],\n.callout[data-callout=tldr])",
  ":where(.callout[data-callout=info])",
  ":where(.callout[data-callout=todo])",
  ":where(.callout[data-callout=tip],\n.callout[data-callout=hint],\n.callout[data-callout=important])",
  ":where(.callout[data-callout=success],\n.callout[data-callout=check],\n.callout[data-callout=done])",
  ":where(.callout[data-callout=question],\n.callout[data-callout=help],\n.callout[data-callout=faq])",
  ":where(.callout[data-callout=warning],\n.callout[data-callout=caution],\n.callout[data-callout=attention])",
  ":where(.callout[data-callout=failure],\n.callout[data-callout=fail],\n.callout[data-callout=missing])",
  ":where(.callout[data-callout=danger],\n.callout[data-callout=error])",
  ":where(.callout[data-callout=bug])",
  ":where(.callout[data-callout=example])",
  ":where(.callout[data-callout=quote],\n.callout[data-callout=cite])",
];

export const lightCalloutTextSelectors = [
  ":where(.theme-light .callout[data-callout=note],\n.theme-light .callout[data-callout=info],\n.theme-light .callout[data-callout=todo])",
  ":where(.theme-light .callout[data-callout=abstract],\n.theme-light .callout[data-callout=summary],\n.theme-light .callout[data-callout=tldr],\n.theme-light .callout[data-callout=tip],\n.theme-light .callout[data-callout=hint],\n.theme-light .callout[data-callout=important])",
  ":where(.theme-light .callout[data-callout=success],\n.theme-light .callout[data-callout=check],\n.theme-light .callout[data-callout=done])",
  ":where(.theme-light .callout[data-callout=question],\n.theme-light .callout[data-callout=help],\n.theme-light .callout[data-callout=faq],\n.theme-light .callout[data-callout=warning],\n.theme-light .callout[data-callout=caution],\n.theme-light .callout[data-callout=attention])",
  ":where(.theme-light .callout[data-callout=failure],\n.theme-light .callout[data-callout=fail],\n.theme-light .callout[data-callout=missing],\n.theme-light .callout[data-callout=danger],\n.theme-light .callout[data-callout=error],\n.theme-light .callout[data-callout=bug])",
  ":where(.theme-light .callout[data-callout=example])",
  ":where(.theme-light .callout[data-callout=quote],\n.theme-light .callout[data-callout=cite])",
];

const allowedThemeSelectors = new Set([
  ".theme-light",
  ".theme-dark",
  "body",
  ".callout",
  ".callout-title",
  ".callout-content",
  ".callout-icon",
  ".callout-icon::before",
  ".callout-icon svg",
  ".callout-fold",
  ".callout.is-collapsed .callout-icon",
  ...calloutTypeSelectors,
  ...lightCalloutTextSelectors,
  ":where(.markdown-rendered pre:not(.frontmatter))",
  ":where(.markdown-rendered pre:not(.frontmatter)) code[class*=language-]",
  ":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock)",
  ".markdown-source-view.mod-cm6 :where(.HyperMD-codeblock)",
  ".markdown-source-view.mod-cm6 :where(.HyperMD-codeblock)::-webkit-scrollbar",
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
