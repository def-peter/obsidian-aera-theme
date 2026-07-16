import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import postcss from "postcss";

import { declarationsFor } from "./helpers/css.mjs";

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
    "--blockquote-background-color": "transparent",
    "--blockquote-border-thickness": "2px",
    "--blockquote-border-color": "var(--text-accent)",
    "--blockquote-font-style": "normal",
    "--blockquote-color": "var(--text-muted)",
    "--hr-color": "var(--background-modifier-border)",
    "--hr-thickness": "1px",
  });
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
  ["background-color", "#272822"],
  ["color", "#f8f8f2"],
  ["border", "1px solid #3e3d32"],
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
    [...monokaiDeclarations, ["border-radius", "6px"]],
  );
});

test("styles CM6 code block lines with direct Monokai declarations", () => {
  assert.deepEqual(
    directDeclarations(
      ":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock)",
    ),
    [
      ...monokaiDeclarations,
      ["border-block-width", "0"],
      ["border-radius", "0"],
    ],
  );
});

test("restores the CM6 code block boundary borders and radii", () => {
  assert.deepEqual(
    directDeclarations(
      ":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock-begin)",
    ),
    [
      ["border-block-start-width", "1px"],
      ["border-radius", "6px 6px 0 0"],
    ],
  );
  assert.deepEqual(
    directDeclarations(
      ":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock-end)",
    ),
    [
      ["border-block-end-width", "1px"],
      ["border-radius", "0 0 6px 6px"],
    ],
  );
});
