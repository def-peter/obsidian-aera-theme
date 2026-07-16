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

test("defines semantic code variables", () => {
  assertDeclarations({
    "--code-background": "var(--background-secondary)",
    "--code-white-space": "pre",
    "--code-size": "0.88em",
    "--code-normal": "var(--text-normal)",
    "--code-comment": "var(--text-faint)",
    "--code-function": "var(--color-blue)",
    "--code-important": "var(--color-orange)",
    "--code-keyword": "var(--text-accent)",
    "--code-operator": "var(--text-muted)",
    "--code-property": "var(--color-cyan)",
    "--code-punctuation": "var(--text-muted)",
    "--code-string": "var(--color-orange)",
    "--code-tag": "var(--color-red)",
    "--code-value": "var(--color-purple)",
  });
});

test("adds the single code block selector with direct border declarations", () => {
  const rules = [];

  postcss.parse(css).walkRules((rule) => {
    if (rule.selector === ".markdown-rendered pre") rules.push(rule);
  });

  assert.equal(rules.length, 1);
  const declarations = rules[0].nodes.filter((node) => node.type === "decl");
  assert.deepEqual(
    declarations.map(({ prop, value }) => [prop, value]),
    [
      ["border", "var(--border-width) solid var(--background-modifier-border)"],
      ["border-radius", "6px"],
    ],
  );
});
