import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import postcss from "postcss";

import { declarationsFor, selectorsFor } from "./helpers/css.mjs";

const css = await readFile(new URL("../theme.css", import.meta.url), "utf8");
const body = declarationsFor(css, "body");

function assertDeclarations(expected) {
  for (const [property, value] of Object.entries(expected)) {
    assert.equal(body.get(property), value, property);
  }
}

test("defines list and task variables", () => {
  assertDeclarations({
    "--list-indent": "2em",
    "--list-indent-editing": "0.75em",
    "--list-spacing": "var(--size-2-1)",
    "--list-marker-color": "var(--text-muted)",
    "--list-marker-color-hover": "var(--text-accent)",
    "--list-marker-color-collapsed": "var(--text-accent)",
    "--list-bullet-border": "1px solid var(--text-muted)",
    "--list-bullet-radius": "50%",
    "--list-bullet-size": "5px",
    "--checkbox-radius": "4px",
    "--checkbox-size": "16px",
    "--checkbox-marker-color": "var(--text-on-accent)",
    "--checkbox-color": "var(--interactive-accent)",
    "--checkbox-color-hover": "var(--interactive-accent-hover)",
    "--checkbox-border-color": "var(--text-faint)",
    "--checkbox-border-color-hover": "var(--text-muted)",
    "--checklist-done-decoration": "line-through",
    "--checklist-done-color": "var(--text-faint)",
  });
});

test("defines quote and horizontal rule variables", () => {
  assertDeclarations({
    "--blockquote-background-color": "var(--aera-quote-background)",
    "--blockquote-border-thickness": "0px",
    "--blockquote-border-color": "transparent",
    "--blockquote-font-style": "normal",
    "--blockquote-style": "normal",
    "--blockquote-color": "var(--text-muted)",
    "--hr-color": "var(--background-modifier-border)",
    "--hr-thickness": "1px",
  });
});

const readingQuoteSelector = ".markdown-rendered blockquote";
const readingFoldSelector =
  ".markdown-rendered blockquote:not(blockquote blockquote)";
const livePreviewQuoteLineSelector =
  ".markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote";
const livePreviewQuoteEndSelector =
  `${livePreviewQuoteLineSelector}:not(:has(+ .HyperMD-quote))`;
const livePreviewQuoteSelector =
  ".markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote)";
const sourceQuoteSelector =
  ".markdown-source-view.mod-cm6:not(.is-live-preview) .HyperMD-quote";

const foldBase = {
  content: '""',
  display: "block",
  position: "absolute",
  "inset-block-start": "-1px",
  "inset-block-end": "auto",
  "inset-inline-start": "-1px",
  width: "17px",
  height: "17px",
  border: "0",
  color: "transparent",
  "pointer-events": "none",
};
const foldCutout = {
  ...foldBase,
  background: "var(--background-primary)",
  "clip-path": "polygon(0 0, 100% 0, 0 100%)",
};
const foldPaperBackground =
  "linear-gradient(135deg, transparent calc(50% - 0.5px), var(--background-modifier-border) calc(50% - 0.5px) calc(50% + 0.5px), var(--aera-quote-fold) calc(50% + 0.5px))";
const livePreviewTopLineBackground =
  "linear-gradient(to right, transparent 0 15px, var(--background-modifier-border) 15px) top/100% 1px no-repeat, var(--aera-quote-background)";

test("styles reading quotes as bordered paper cards", () => {
  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, readingQuoteSelector)),
    {
      position: "relative",
      "margin-inline": "0",
      padding: "var(--size-4-4) var(--size-4-5)",
      background: "var(--aera-quote-background)",
      border: "1px solid var(--background-modifier-border)",
      "border-radius": "6px",
      color: "var(--blockquote-color)",
    },
  );
});

test("shares the reading quote surface with live preview", () => {
  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, livePreviewQuoteLineSelector)),
    {
      "margin-inline": "0",
      "padding-inline": "var(--size-4-5)",
      background: "var(--aera-quote-background)",
      "border-inline": "1px solid var(--background-modifier-border)",
      color: "var(--blockquote-color)",
    },
  );

  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, livePreviewQuoteEndSelector)),
    {
      "padding-block-end": "var(--size-4-4)",
      "border-block-end": "1px solid var(--background-modifier-border)",
      "border-end-start-radius": "6px",
      "border-end-end-radius": "6px",
    },
  );
});

test("renders a folded corner on reading quotes", () => {
  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, `${readingFoldSelector}::before`)),
    {
      ...foldCutout,
    },
  );
  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, `${readingFoldSelector}::after`)),
    {
      ...foldBase,
      background: foldPaperBackground,
      "clip-path": "polygon(100% 0, 100% 100%, 0 100%)",
    },
  );

  const selectors = selectorsFor(css);
  assert.equal(selectors.has(`${readingQuoteSelector}::before`), false);
  assert.equal(selectors.has(`${readingQuoteSelector}::after`), false);
});

test("adds one folded corner to the first live preview quote line", () => {
  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, livePreviewQuoteSelector)),
    {
      position: "relative",
      "padding-block-start": "var(--size-4-4)",
      background: livePreviewTopLineBackground,
      "border-block-start": "0",
      "border-start-start-radius": "6px",
      "border-start-end-radius": "6px",
    },
  );
  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, `${livePreviewQuoteSelector}::before`)),
    {
      ...foldCutout,
    },
  );
  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, `${livePreviewQuoteSelector}::after`)),
    {
      ...foldBase,
      background: foldPaperBackground,
      "clip-path": "polygon(100% 0, 100% 100%, 0 100%)",
    },
  );
});

test("keeps source mode markers visible on a plain quote surface", () => {
  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, sourceQuoteSelector)),
    {
      background: "var(--aera-quote-background)",
      color: "var(--blockquote-color)",
    },
  );

  const selectors = selectorsFor(css);
  assert.equal(selectors.has(`${sourceQuoteSelector}::before`), false);
  assert.equal(selectors.has(`${sourceQuoteSelector}::after`), false);
});

test("limits relational has selectors to the live preview quote ending", () => {
  const relationalSelectors = [...selectorsFor(css)].filter((selector) =>
    selector.includes(":has("),
  );

  assert.deepEqual(relationalSelectors, [livePreviewQuoteEndSelector]);
});

test("keeps inline code on the Aera grayscale", () => {
  const codeDeclarations = Object.fromEntries(
    [...body].filter(([property]) => property.startsWith("--code-")),
  );

  assert.deepEqual(codeDeclarations, {
    "--code-background": "var(--aera-inline-code-background)",
    "--code-normal": "var(--aera-inline-code-color)",
    "--code-white-space": "pre",
    "--code-size": ".88em",
  });
});

const monokaiDeclarations = [
  ["--code-background", "#272822"],
  ["--code-normal", "#f8f8f2"],
  ["--code-comment", "#929388"],
  ["--code-function", "#a6e22e"],
  ["--code-important", "#fd971f"],
  ["--code-keyword", "#ff4b8b"],
  ["--code-operator", "#f8f8f2"],
  ["--code-punctuation", "#f8f8f2"],
  ["--code-property", "#66d9ef"],
  ["--code-string", "#e6db74"],
  ["--code-tag", "#ff4b8b"],
  ["--code-value", "#ae81ff"],
  ["--code-border-width", "1px"],
  ["--code-border-color", "#3e3d32"],
  ["--code-radius", "6px"],
  ["background-color", "#272822"],
  ["color", "#f8f8f2"],
];

function directDeclarations(selector) {
  const rules = [];

  postcss.parse(css).walkRules((rule) => {
    if (rule.selector === selector) rules.push(rule);
  });

  assert.equal(rules.length, 1);
  return rules[0].nodes
    .filter((node) => node.type === "decl")
    .map(({ prop, value }) => [prop, value]);
}

test("styles reading code blocks with direct Monokai declarations", () => {
  assert.deepEqual(
    directDeclarations(":where(.markdown-rendered pre:not(.frontmatter))"),
    monokaiDeclarations,
  );
});

test("keeps reading code lines unwrapped inside the scrollable block", () => {
  assert.deepEqual(
    Object.fromEntries(
      declarationsFor(
        css,
        ":where(.markdown-rendered pre:not(.frontmatter)) code[class*=language-]",
      ),
    ),
    { "white-space": "pre" },
  );
});

test("styles CM6 code block lines with direct Monokai declarations", () => {
  assert.deepEqual(
    directDeclarations(
      ":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock)",
    ),
    monokaiDeclarations,
  );
});

test("keeps CM6 fenced code lines on one horizontal line", () => {
  assert.deepEqual(
    directDeclarations(
      ".markdown-source-view.mod-cm6 :where(.HyperMD-codeblock)",
    ),
    [
      ["white-space", "pre"],
      ["word-break", "normal"],
      ["overflow-wrap", "normal"],
      ["width", "auto"],
      ["min-width", "0"],
      ["overflow-x", "auto"],
      ["overflow-y", "hidden"],
      ["scrollbar-width", "none"],
    ],
  );
});

test("hides only CM6 fenced code line scrollbars", () => {
  const scrollbarSelector =
    ".markdown-source-view.mod-cm6 :where(.HyperMD-codeblock)::-webkit-scrollbar";

  assert.deepEqual(directDeclarations(scrollbarSelector), [
    ["width", "0"],
    ["height", "0"],
  ]);

  const selectors = selectorsFor(css);
  assert.equal(selectors.has(".HyperMD-codeblock::-webkit-scrollbar"), false);
  assert.equal(
    selectors.has(".markdown-source-view.mod-cm6::-webkit-scrollbar"),
    false,
  );
});
