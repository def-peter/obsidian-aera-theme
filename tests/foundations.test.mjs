import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CORE_CONTRAST_PAIRS,
  contrastRatio,
  relativeLuminance,
  runContrastCli,
} from "../scripts/contrast.mjs";
import { declarationsFor } from "./helpers/css.mjs";

const css = await readFile(new URL("../theme.css", import.meta.url), "utf8");
const normalizeWhitespace = (value) => value.replace(/\s+/g, " ");

test("body defines the Aera reading typography without overriding user sizing", () => {
  const body = declarationsFor(css, "body");

  assert.equal(
    normalizeWhitespace(body.get("--font-text-theme")),
    '"Avenir Next", Avenir, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  );
  assert.equal(
    normalizeWhitespace(body.get("--font-monospace-theme")),
    'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace',
  );
  assert.equal(body.get("--line-height-normal"), "1.8");
  assert.equal(body.get("--p-spacing"), "var(--size-4-3)");
  assert.equal(body.get("--heading-spacing"), "var(--size-4-8)");
  assert.equal(body.get("--bold-modifier"), "200");
  for (const property of [
    "--font-interface-theme",
    "--font-text-size",
    "--file-line-width",
  ]) {
    assert.equal(body.has(property), false, `${property} must remain user-controlled`);
  }
});

const expectedColors = {
  ".theme-light": {
    "--color-base-00": "#f7f8f6",
    "--color-base-05": "#f4f5f3",
    "--color-base-10": "#eff1ef",
    "--color-base-20": "#e8ebe8",
    "--color-base-25": "#dde2de",
    "--color-base-30": "#d1d7d2",
    "--color-base-35": "#c4cbc5",
    "--color-base-40": "#aeb7b0",
    "--color-base-50": "#8b958e",
    "--color-base-60": "#68756d",
    "--color-base-70": "#4e5b53",
    "--color-base-100": "#28302c",
    "--background-primary": "var(--color-base-00)",
    "--background-secondary": "var(--color-base-10)",
    "--text-normal": "var(--color-base-100)",
    "--text-muted": "var(--color-base-60)",
    "--text-faint": "var(--color-base-50)",
    "--text-highlight-bg": "rgba(191, 168, 68, 0.26)",
    "--accent-h": "152.9",
    "--accent-s": "28.8%",
    "--accent-l": "34.7%",
  },
  ".theme-dark": {
    "--color-base-00": "#171c19",
    "--color-base-05": "#1a201c",
    "--color-base-10": "#202720",
    "--color-base-20": "#262e29",
    "--color-base-25": "#2d3630",
    "--color-base-30": "#364139",
    "--color-base-35": "#414d45",
    "--color-base-40": "#526058",
    "--color-base-50": "#6d7b72",
    "--color-base-60": "#95a39b",
    "--color-base-70": "#bbc7c0",
    "--color-base-100": "#dce4df",
    "--background-primary": "var(--color-base-00)",
    "--background-secondary": "var(--color-base-10)",
    "--text-normal": "var(--color-base-100)",
    "--text-muted": "var(--color-base-60)",
    "--text-faint": "var(--color-base-50)",
    "--text-highlight-bg": "rgba(191, 168, 68, 0.28)",
    "--accent-h": "148.6",
    "--accent-s": "31.1%",
    "--accent-l": "59%",
  },
};

for (const [selector, expected] of Object.entries(expectedColors)) {
  test(`${selector} defines the complete Aera color foundation`, () => {
    const declarations = declarationsFor(css, selector);

    for (const [property, value] of Object.entries(expected)) {
      assert.equal(declarations.get(property), value, `${selector} ${property}`);
    }
  });
}

test("six core foreground/background pairs meet WCAG AA contrast", () => {
  assert.deepEqual(CORE_CONTRAST_PAIRS, [
    ["light text", "#28302c", "#f7f8f6"],
    ["light muted", "#68756d", "#f7f8f6"],
    ["light accent", "#3f725b", "#f7f8f6"],
    ["dark text", "#dce4df", "#171c19"],
    ["dark muted", "#95a39b", "#171c19"],
    ["dark accent", "#76b795", "#171c19"],
  ]);

  for (const [name, foreground, background] of CORE_CONTRAST_PAIRS) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${name} must meet WCAG AA`,
    );
  }
});

test("contrast calculation matches WCAG reference endpoints", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#68756d", "#68756d"), 1);
});

test("contrast CLI prints all six pairs", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../scripts/contrast.mjs", import.meta.url))],
    { encoding: "utf8" },
  );
  const lines = result.stdout.trim().split("\n");

  assert.equal(result.status, 0, result.stderr);
  assert.equal(lines.length, 6);
  for (const [index, [name]] of CORE_CONTRAST_PAIRS.entries()) {
    assert.match(lines[index], new RegExp(`^PASS ${name}:`));
  }
});

test("contrast CLI marks a failing pair and requests exit code 1", () => {
  const originalExitCode = process.exitCode;
  const output = [];

  try {
    process.exitCode = undefined;
    runContrastCli(
      [["failing pair", "#777777", "#777777"]],
      (line) => output.push(line),
    );

    assert.equal(process.exitCode, 1);
    assert.match(output[0], /^FAIL failing pair: 1\.00:1/);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test("contrast helpers reject invalid hex colors with a clear error", () => {
  for (const value of ["#fff", "28302c", "#gggggg", "#1234567", 42]) {
    assert.throws(
      () => relativeLuminance(value),
      (error) =>
        error instanceof TypeError &&
        error.message === `Invalid hex color: ${String(value)}`,
    );
  }

  assert.throws(
    () => contrastRatio("#28302c", "not-a-color"),
    /Invalid hex color: not-a-color/,
  );
});
