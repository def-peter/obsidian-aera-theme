import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { declarationsFor } from "./helpers/css.mjs";

const css = await readFile(new URL("../theme.css", import.meta.url), "utf8");
const body = declarationsFor(css, "body");

function assertDeclarations(expected) {
  for (const [property, value] of Object.entries(expected)) {
    assert.equal(body.get(property), value, property);
  }
}

test("defines the inline title hierarchy", () => {
  assertDeclarations({
    "--inline-title-color": "var(--text-normal)",
    "--inline-title-font": "var(--font-text)",
    "--inline-title-line-height": "1.25",
    "--inline-title-size": "2em",
    "--inline-title-weight": "650",
  });
});

test("defines heading colors", () => {
  assertDeclarations({
    "--h1-color": "var(--text-normal)",
    "--h2-color": "var(--text-normal)",
    "--h3-color": "var(--text-normal)",
    "--h4-color": "var(--text-normal)",
    "--h5-color": "var(--text-normal)",
    "--h6-color": "var(--text-muted)",
  });
});

test("defines heading line heights", () => {
  assertDeclarations({
    "--h1-line-height": "1.28",
    "--h2-line-height": "1.35",
    "--h3-line-height": "1.4",
    "--h4-line-height": "1.45",
    "--h5-line-height": "1.5",
    "--h6-line-height": "1.5",
  });
});

test("defines relative heading sizes", () => {
  assertDeclarations({
    "--h1-size": "1.85em",
    "--h2-size": "1.42em",
    "--h3-size": "1.16em",
    "--h4-size": "1.05em",
    "--h5-size": "1em",
    "--h6-size": "0.9em",
  });
});

test("defines heading weights", () => {
  assertDeclarations({
    "--h1-weight": "650",
    "--h2-weight": "650",
    "--h3-weight": "600",
    "--h4-weight": "600",
    "--h5-weight": "600",
    "--h6-weight": "600",
  });
});

test("keeps bold and italic text on the normal text color", () => {
  assertDeclarations({
    "--bold-color": "var(--text-normal)",
    "--italic-color": "var(--text-normal)",
  });
});

test("derives internal links from the user accent", () => {
  assertDeclarations({
    "--link-color": "var(--text-accent)",
    "--link-color-hover": "var(--text-accent-hover)",
    "--link-decoration": "none",
    "--link-decoration-hover": "underline",
    "--link-decoration-thickness": "1px",
    "--link-weight": "500",
  });
});

test("distinguishes unresolved links with a faint dotted decoration", () => {
  assertDeclarations({
    "--link-unresolved-color": "var(--text-muted)",
    "--link-unresolved-opacity": "1",
    "--link-unresolved-decoration-style": "dotted",
    "--link-unresolved-decoration-color": "var(--text-faint)",
  });
});

test("derives external links from the user accent", () => {
  assertDeclarations({
    "--link-external-color": "var(--text-accent)",
    "--link-external-color-hover": "var(--text-accent-hover)",
    "--link-external-decoration": "none",
    "--link-external-decoration-hover": "underline",
  });
});
