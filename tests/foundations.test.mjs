import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CALLOUT_CONTRAST_PAIRS,
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
    "--color-base-00": "#f8fafc",
    "--color-base-05": "#f5f7fa",
    "--color-base-10": "#f1f4f8",
    "--color-base-20": "#e9eef5",
    "--color-base-25": "#dde3eb",
    "--color-base-30": "#cdd5df",
    "--color-base-35": "#bec8d4",
    "--color-base-40": "#a9b4c2",
    "--color-base-50": "#8793a3",
    "--color-base-60": "#647184",
    "--color-base-70": "#475467",
    "--color-base-100": "#202936",
    "--background-primary": "var(--color-base-00)",
    "--background-secondary": "var(--color-base-10)",
    "--text-normal": "var(--color-base-100)",
    "--text-muted": "var(--color-base-60)",
    "--text-faint": "var(--color-base-50)",
    "--text-highlight-bg": "rgba(245, 198, 50, 0.22)",
    "--accent-h": "215",
    "--accent-s": "100%",
    "--accent-l": "54.3%",
    "--interactive-accent": "hsl(var(--accent-h), var(--accent-s), var(--accent-l))",
    "--text-accent":
      "hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) - 10%))",
    "--text-accent-hover":
      "hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) - 14%))",
    "--aera-inline-code-background": "#d9dee5",
    "--aera-inline-code-color": "#566273",
    "--aera-callout-background-opacity": "0.08",
    "--aera-callout-title-semantic-weight": "52%",
    "--aera-callout-body-semantic-weight": "50%",
    "--aera-quote-background": "#f1f3f6",
    "--aera-quote-fold": "#d9dee5",
  },
  ".theme-dark": {
    "--color-base-00": "#17191c",
    "--color-base-05": "#1b1e22",
    "--color-base-10": "#20242a",
    "--color-base-20": "#282d34",
    "--color-base-25": "#30363e",
    "--color-base-30": "#39414b",
    "--color-base-35": "#46505c",
    "--color-base-40": "#596575",
    "--color-base-50": "#748092",
    "--color-base-60": "#9aa5b4",
    "--color-base-70": "#c1c7d0",
    "--color-base-100": "#e7ebf0",
    "--background-primary": "var(--color-base-00)",
    "--background-secondary": "var(--color-base-10)",
    "--text-normal": "var(--color-base-100)",
    "--text-muted": "var(--color-base-60)",
    "--text-faint": "var(--color-base-50)",
    "--text-highlight-bg": "rgba(245, 198, 50, 0.26)",
    "--accent-h": "213",
    "--accent-s": "100%",
    "--accent-l": "62.5%",
    "--interactive-accent": "hsl(var(--accent-h), var(--accent-s), var(--accent-l))",
    "--text-accent": "hsl(var(--accent-h), var(--accent-s), var(--accent-l))",
    "--text-accent-hover":
      "hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) + 5%))",
    "--aera-inline-code-background": "#2a2f36",
    "--aera-inline-code-color": "#b8c0cc",
    "--aera-callout-background-opacity": "0.12",
    "--aera-callout-title-semantic-weight": "84%",
    "--aera-callout-body-semantic-weight": "72%",
    "--aera-quote-background": "#22262c",
    "--aera-quote-fold": "#3a414a",
  },
};

const calloutTypeColors = {
  ".theme-light": {
    note: [8, 109, 221],
    warning: [236, 117, 0],
    error: [233, 49, 71],
    example: [120, 82, 238],
    quote: [158, 158, 158],
    tip: [0, 191, 188],
  },
  ".theme-dark": {
    note: [2, 122, 255],
    warning: [233, 151, 63],
    error: [251, 70, 76],
    example: [168, 130, 255],
    quote: [158, 158, 158],
    tip: [83, 223, 221],
  },
};

function hexChannels(hex) {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
}

function mixChannels(foreground, background, foregroundWeight) {
  return foreground.map(
    (channel, index) =>
      channel * foregroundWeight + background[index] * (1 - foregroundWeight),
  );
}

function channelLuminance(channel) {
  const srgb = channel / 255;
  return srgb <= 0.04045
    ? srgb / 12.92
    : ((srgb + 0.055) / 1.055) ** 2.4;
}

function channelContrastRatio(foreground, background) {
  const luminance = (channels) => {
    const [red, green, blue] = channels.map(channelLuminance);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function calloutSemanticWeight(colorDeclaration, themeDeclarations) {
  const literal = colorDeclaration.match(
    /rgb\(var\(--callout-color\)\) ([0-9.]+)%/,
  );
  if (literal) return Number(literal[1]) / 100;

  const variable = colorDeclaration.match(
    /rgb\(var\(--callout-color\)\) var\((--[^)]+)\)/,
  );
  assert.ok(variable, colorDeclaration);
  return Number.parseFloat(themeDeclarations.get(variable[1])) / 100;
}

for (const [selector, expected] of Object.entries(expectedColors)) {
  test(`${selector} defines the complete Aera color foundation`, () => {
    const declarations = declarationsFor(css, selector);

    for (const [property, value] of Object.entries(expected)) {
      assert.equal(declarations.get(property), value, `${selector} ${property}`);
    }
  });
}

test("semantic callout titles and content meet WCAG AA in both themes", () => {
  const roles = [
    ["title", declarationsFor(css, ".callout-title").get("color")],
    ["content", declarationsFor(css, ".callout").get("color")],
  ];

  for (const [themeSelector, types] of Object.entries(calloutTypeColors)) {
    const theme = declarationsFor(css, themeSelector);
    const base = hexChannels(theme.get("--color-base-00"));
    const normal = hexChannels(theme.get("--color-base-100"));
    const backgroundOpacity = Number.parseFloat(
      theme.get("--aera-callout-background-opacity"),
    );

    for (const [type, semantic] of Object.entries(types)) {
      const background = mixChannels(semantic, base, backgroundOpacity);

      for (const [role, colorDeclaration] of roles) {
        const weight = calloutSemanticWeight(colorDeclaration, theme);
        const foreground = mixChannels(semantic, normal, weight);
        const ratio = channelContrastRatio(foreground, background);
        assert.ok(
          ratio >= 4.5,
          `${themeSelector} ${type} ${role} is ${ratio.toFixed(2)}:1`,
        );
      }
    }
  }
});

test("eleven core foreground/background pairs meet WCAG AA contrast", () => {
  assert.deepEqual(CORE_CONTRAST_PAIRS, [
    ["light text", "#202936", "#f8fafc"],
    ["light muted", "#647184", "#f8fafc"],
    ["light text accent", "#005ee2", "#f8fafc"],
    ["dark text", "#e7ebf0", "#17191c"],
    ["dark muted", "#9aa5b4", "#17191c"],
    ["dark text accent", "#4096ff", "#17191c"],
    ["light inline code", "#566273", "#d9dee5"],
    ["dark inline code", "#b8c0cc", "#2a2f36"],
    ["monokai normal", "#f8f8f2", "#272822"],
    ["monokai comment", "#929388", "#272822"],
    ["monokai keyword", "#ff4b8b", "#272822"],
  ]);

  for (const [name, foreground, background] of CORE_CONTRAST_PAIRS) {
    assert.ok(
      contrastRatio(foreground, background) >= 4.5,
      `${name} must meet WCAG AA`,
    );
  }
});

test("core contrast ratios match the WCAG calculations", () => {
  const expectedRatios = [
    "14.02",
    "4.74",
    "5.43",
    "14.71",
    "7.06",
    "5.89",
    "4.58",
    "7.35",
    "13.94",
    "4.78",
    "4.69",
  ];

  for (const [index, [, foreground, background]] of CORE_CONTRAST_PAIRS.entries()) {
    assert.equal(contrastRatio(foreground, background).toFixed(2), expectedRatios[index]);
  }
});

test("contrast calculation matches WCAG reference endpoints", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#647184", "#647184"), 1);
});

test("contrast CLI prints the core and semantic callout pairs", () => {
  assert.equal(CALLOUT_CONTRAST_PAIRS.length, 24);
  const allPairs = [
    ...CORE_CONTRAST_PAIRS,
    ...CALLOUT_CONTRAST_PAIRS,
  ];
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../scripts/contrast.mjs", import.meta.url))],
    { encoding: "utf8" },
  );
  const lines = result.stdout.trim().split("\n");

  assert.equal(result.status, 0, result.stderr);
  assert.equal(lines.length, 35);
  for (const [index, [name, foreground, background]] of allPairs.entries()) {
    assert.ok(contrastRatio(foreground, background) >= 4.5, name);
    assert.match(lines[index], new RegExp(`^PASS ${name}:`));
  }
});

test("contrast CLI runs when invoked through a symbolic link", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "aera-contrast-cli-"));
  const symlinkPath = join(directory, "contrast.mjs");
  const cliPath = fileURLToPath(new URL("../scripts/contrast.mjs", import.meta.url));
  t.after(() => rmSync(directory, { recursive: true, force: true }));

  try {
    symlinkSync(cliPath, symlinkPath);
  } catch (error) {
    if (["EACCES", "EPERM"].includes(error.code)) {
      t.skip("creating symbolic links is not permitted in this environment");
      return;
    }
    throw error;
  }

  const result = spawnSync(process.execPath, [symlinkPath], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS light text:/);
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
  for (const value of ["#fff", "202936", "#gggggg", "#1234567", 42]) {
    assert.throws(
      () => relativeLuminance(value),
      (error) =>
        error instanceof TypeError &&
        error.message === `Invalid hex color: ${String(value)}`,
    );
  }

  assert.throws(
    () => contrastRatio("#202936", "not-a-color"),
    /Invalid hex color: not-a-color/,
  );
});
