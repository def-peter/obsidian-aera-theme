import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertThemeStructure,
  declarationsFor,
  selectorsFor,
} from "./helpers/css.mjs";

const css = await readFile(new URL("../theme.css", import.meta.url), "utf8");
const body = declarationsFor(css, "body");
const allowedSelectors = new Set([
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
  ":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock)",
]);
const officialCalloutTypeVariables = [
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
];

function assertPrefixedDeclarations(prefixes, expected) {
  const actual = Object.fromEntries(
    [...body].filter(([property]) =>
      prefixes.some((prefix) => property.startsWith(prefix)),
    ),
  );

  assert.deepEqual(actual, expected);
}

test("uses only the allowed low-specificity selectors", () => {
  assert.deepEqual(selectorsFor(css), allowedSelectors);
});

test("rejects unexpected selectors in memory", () => {
  for (const selector of [".mobile-only", ".markdown-source-view"]) {
    assert.throws(
      () => assertThemeStructure(`${css}\n${selector} { color: red; }`),
      /unexpected theme selector/,
    );
  }
});

test("rejects callout variables outside body in memory", () => {
  assert.throws(
    () =>
      assertThemeStructure(
        `${css}\n.callout[data-callout="warning"] { --callout-color: red; }`,
      ),
    /--callout-color.*body/,
  );
});

test("rejects official callout type variables globally in memory", () => {
  for (const property of officialCalloutTypeVariables) {
    assert.throws(
      () => assertThemeStructure(`${css}\nbody { ${property}: red; }`),
      new RegExp(`${property}.*semantic type`),
    );
  }
});

test("the compiled theme respects component structure boundaries", () => {
  assert.doesNotThrow(() => assertThemeStructure(css));
});

test("styles callouts without replacing semantic type colors", () => {
  assertPrefixedDeclarations(["--callout-"], {
    "--callout-padding": "var(--size-4-3) var(--size-4-4)",
    "--callout-title-padding": "0",
    "--callout-content-padding": "var(--size-4-2) 0 0",
    "--callout-border-width": "0px",
    "--callout-border-opacity": "0",
    "--callout-radius": "7px",
    "--callout-blend-mode": "normal",
    "--callout-title-size": "var(--font-small)",
    "--callout-title-weight": "600",
    "--callout-content-background": "transparent",
  });

  for (const property of officialCalloutTypeVariables) {
    assert.equal(body.has(property), false, property);
  }
});

test("uses a borderless semantic callout surface", () => {
  const callout = declarationsFor(css, ".callout");

  assert.deepEqual(Object.fromEntries(callout), {
    position: "relative",
    overflow: "hidden",
    "background-color":
      "rgba(var(--callout-color), var(--aera-callout-background-opacity))",
    color:
      "color-mix(in srgb, rgb(var(--callout-color)) 72%, var(--text-normal))",
    border: "0",
  });
});

test("keeps callout text clear of the watermark", () => {
  const title = declarationsFor(css, ".callout-title");
  const content = declarationsFor(css, ".callout-content");

  assert.equal(title.has("position"), false);
  assert.deepEqual(Object.fromEntries(title), {
    "padding-inline-end": "var(--size-4-12)",
    color:
      "color-mix(in srgb, rgb(var(--callout-color)) 84%, var(--text-normal))",
  });
  assert.deepEqual(Object.fromEntries(content), {
    "padding-inline-end": "var(--size-4-12)",
  });
});

test("renders the native callout icon as a non-interactive watermark", () => {
  assert.deepEqual(Object.fromEntries(declarationsFor(css, ".callout-icon")), {
    position: "absolute",
    "inset-inline-end": "var(--size-4-2)",
    "inset-block-end": "calc(var(--size-4-2) * -1)",
    opacity: "0.09",
    "pointer-events": "none",
  });
  assert.deepEqual(
    Object.fromEntries(declarationsFor(css, ".callout-icon svg")),
    {
      width: "48px",
      height: "48px",
    },
  );
  assert.deepEqual(Object.fromEntries(declarationsFor(css, ".callout-fold")), {
    position: "relative",
    "z-index": "2",
  });
  assert.deepEqual(
    Object.fromEntries(
      declarationsFor(css, ".callout.is-collapsed .callout-icon"),
    ),
    { display: "none" },
  );
});

test("defines the complete table component variables", () => {
  assertPrefixedDeclarations(["--table-"], {
    "--table-background": "transparent",
    "--table-border-width": "1px",
    "--table-border-color": "var(--background-modifier-border)",
    "--table-cell-vertical-alignment": "top",
    "--table-white-space": "normal",
    "--table-header-background": "var(--background-secondary)",
    "--table-header-background-hover": "var(--background-modifier-hover)",
    "--table-header-border-width": "1px",
    "--table-header-border-color": "var(--background-modifier-border)",
    "--table-header-size": "var(--font-small)",
    "--table-header-weight": "600",
    "--table-header-color": "var(--text-muted)",
    "--table-line-height": "1.5",
    "--table-text-size": "var(--font-small)",
    "--table-text-color": "var(--text-normal)",
    "--table-row-background-hover": "var(--background-modifier-hover)",
    "--table-selection-border-color": "var(--interactive-accent)",
    "--table-selection-border-width": "1px",
    "--table-selection-border-radius": "4px",
  });
});

test("defines the complete metadata component variables", () => {
  assertPrefixedDeclarations(["--metadata-"], {
    "--metadata-gap": "var(--size-2-3)",
    "--metadata-property-padding": "var(--size-2-3) var(--size-4-2)",
    "--metadata-background": "transparent",
    "--metadata-border-color": "transparent",
    "--metadata-border-radius": "0",
    "--metadata-border-width": "0px",
    "--metadata-divider-color": "var(--background-modifier-border)",
    "--metadata-divider-color-hover": "var(--background-modifier-border-hover)",
    "--metadata-divider-color-focus": "var(--interactive-accent)",
    "--metadata-divider-width": "1px",
    "--metadata-property-radius": "4px",
    "--metadata-property-radius-hover": "4px",
    "--metadata-property-radius-focus": "4px",
    "--metadata-label-font-size": "var(--font-smallest)",
    "--metadata-label-font-weight": "500",
    "--metadata-label-text-color": "var(--text-faint)",
    "--metadata-input-font-size": "var(--font-small)",
    "--metadata-input-text-color": "var(--text-normal)",
    "--metadata-input-background": "transparent",
  });
});

test("defines embed boundaries and footnote typography", () => {
  assertPrefixedDeclarations(["--embed-", "--footnote-"], {
    "--embed-padding": "0 0 0 var(--size-4-4)",
    "--embed-background": "transparent",
    "--embed-border-start": "2px solid var(--background-modifier-border)",
    "--embed-border-end": "0",
    "--embed-border-top": "0",
    "--embed-border-bottom": "0",
    "--embed-font-style": "normal",
    "--footnote-size": "var(--font-smallest)",
  });
});

test("defines the complete tag component variables", () => {
  assertPrefixedDeclarations(["--tag-"], {
    "--tag-padding-x": "var(--size-2-3)",
    "--tag-padding-y": "var(--size-2-1)",
    "--tag-size": "var(--font-smallest)",
    "--tag-color": "var(--text-accent)",
    "--tag-color-hover": "var(--text-accent-hover)",
    "--tag-decoration": "none",
    "--tag-decoration-hover": "none",
    "--tag-background": "var(--background-secondary)",
    "--tag-background-hover": "var(--background-modifier-hover)",
    "--tag-border-color": "var(--background-modifier-border)",
    "--tag-border-color-hover": "var(--background-modifier-border-hover)",
    "--tag-border-width": "1px",
    "--tag-radius": "4px",
    "--tag-weight": "500",
  });
});
