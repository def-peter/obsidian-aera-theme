import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  validateCss,
  validateManifest,
  validateReleaseTag,
  validateVersions,
} from "../scripts/theme-policy.mjs";

const validManifest = {
  name: "Aera",
  version: "0.1.0",
  minAppVersion: "1.12.7",
  author: "Peter",
};
const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const cliPath = join(repoRoot, "scripts/check-theme.mjs");

function runCli(args = [], cwd = repoRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
  });
}

function createThemeFixture(t, overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), "aera-theme-policy-"));
  const files = {
    "manifest.json": `${JSON.stringify(validManifest)}\n`,
    "package.json": `${JSON.stringify({ version: validManifest.version })}\n`,
    "versions.json": `${JSON.stringify({ "0.1.0": "1.12.7" })}\n`,
    "theme.css": ":root { --aera-accent: #3d6b5f; }\n",
    ...overrides,
  };

  for (const [name, contents] of Object.entries(files)) {
    if (contents !== null) writeFileSync(join(directory, name), contents);
  }
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("validateManifest accepts the Aera theme manifest", () => {
  assert.deepEqual(validateManifest(validManifest), []);
});

test("validateManifest rejects plugin-only description metadata", () => {
  const errors = validateManifest({
    ...validManifest,
    description: "Plugin metadata does not belong in a theme manifest.",
  });

  assert.ok(errors.some((error) => error.includes("description")));
});

test("validateManifest rejects values that are not plain objects", () => {
  for (const manifest of [null, [], new Date()]) {
    assert.match(validateManifest(manifest).join("\n"), /plain object/);
  }
});

test("validateManifest requires non-empty trimmed strings", () => {
  for (const key of ["author", "minAppVersion", "name", "version"]) {
    const errors = validateManifest({ ...validManifest, [key]: " \t " });
    assert.ok(errors.some((error) => error.includes(`requires ${key}`)));
  }
});

test("validateManifest validates optional URL metadata shapes", () => {
  assert.deepEqual(
    validateManifest({
      ...validManifest,
      authorUrl: "https://example.com",
      fundingUrl: { GitHub: "https://github.com/sponsors/example" },
    }),
    [],
  );

  assert.match(
    validateManifest({ ...validManifest, authorUrl: 42 }).join("\n"),
    /authorUrl.*string/,
  );
  assert.match(
    validateManifest({ ...validManifest, fundingUrl: { GitHub: 42 } }).join("\n"),
    /fundingUrl.*string/,
  );
  assert.match(
    validateManifest({ ...validManifest, fundingUrl: ["https://example.com"] }).join(
      "\n",
    ),
    /fundingUrl.*string|plain object/,
  );
});

test("validateManifest rejects semantic versions with leading zeroes", () => {
  assert.match(
    validateManifest({ ...validManifest, version: "01.2.3" }).join("\n"),
    /manifest version.*x\.y\.z/,
  );
  assert.match(
    validateManifest({ ...validManifest, minAppVersion: "1.02.3" }).join("\n"),
    /minAppVersion.*x\.y\.z/,
  );
});

test("validateVersions requires the current version to map to minAppVersion", () => {
  assert.deepEqual(validateVersions(validManifest, { "0.1.0": "1.12.7" }), []);

  const errors = validateVersions(validManifest, { "0.1.0": "1.12.6" });
  assert.ok(errors.some((error) => error.includes("versions.json")));
});

test("validateVersions requires a plain object with strict semantic versions", () => {
  for (const versions of [null, []]) {
    assert.match(validateVersions(validManifest, versions).join("\n"), /plain object/);
  }

  assert.match(
    validateVersions(validManifest, {
      "0.1.0": "1.12.7",
      "01.0.0": "1.12.7",
    }).join("\n"),
    /version key.*x\.y\.z/,
  );
  assert.match(
    validateVersions(validManifest, {
      "0.1.0": "1.12.7",
      "0.2.0": "1.02.3",
    }).join("\n"),
    /minAppVersion.*x\.y\.z/,
  );
});

const forbiddenCss = [
  ["!important", ".notice { color: red !important; }", "!important"],
  [":has(", ".item:has(.active) { color: red; }", ":has"],
  [
    "remote URL",
    ".hero { background: url(https://example.com/image.png); }",
    "remote URL",
  ],
  ["--font-text-size", ":root { --font-text-size: 16px; }", "--font-text-size"],
  ["--file-line-width", ":root { --file-line-width: 48rem; }", "--file-line-width"],
  [
    "--font-interface-theme",
    ":root { --font-interface-theme: Inter; }",
    "--font-interface-theme",
  ],
  ["sourceMappingURL", "/*# sourceMappingURL=theme.css.map */", "source map"],
];

for (const [policy, css, expectedError] of forbiddenCss) {
  test(`validateCss rejects ${policy}`, () => {
    assert.ok(
      validateCss(css).some((error) => error.includes(expectedError)),
      `expected ${policy} to produce its policy error`,
    );
  });
}

test("validateCss accepts CSS that follows theme policy", () => {
  assert.deepEqual(validateCss(":root { --aera-accent: #3d6b5f; }"), []);
});

test("validateCss rejects every runtime import", () => {
  for (const css of [
    '@import "https://example.com/theme.css";',
    '@IMPORT "local.css";',
    "@ImPoRt url(//example.com/theme.css);",
    '@import "\\68 ttps://example.com/theme.css";',
  ]) {
    assert.match(validateCss(css).join("\n"), /theme\.css must not contain @import/);
  }
});

test("validateCss rejects protocol-relative URLs in declarations", () => {
  assert.match(
    validateCss(".hero { background: url(//example.com/image.png); }").join("\n"),
    /remote URL/,
  );
});

test("validateCss preserves custom property case sensitivity", () => {
  const css = `
    :root {
      --FONT-TEXT-SIZE: 16px;
      --FILE-LINE-WIDTH: 48rem;
      --FONT-INTERFACE-THEME: Inter;
    }
  `;

  assert.deepEqual(validateCss(css), []);
});

test("validateCss ignores policy-like text inside ordinary comments", () => {
  const css = `
    /* !important :has(.item) url(https://example.com/image.png)
       --font-text-size: 18px; --file-line-width: 48rem;
       --font-interface-theme: Inter; */
    :root { --aera-accent: #3d6b5f; }
  `;

  assert.deepEqual(validateCss(css), []);
});

test("validateReleaseTag accepts an empty or matching release tag", () => {
  assert.deepEqual(validateReleaseTag(validManifest, ""), []);
  assert.deepEqual(validateReleaseTag(validManifest, "0.1.0"), []);
});

test("validateReleaseTag rejects a mismatched release tag", () => {
  const errors = validateReleaseTag(validManifest, "0.2.0");
  assert.ok(errors.some((error) => error.includes("0.2.0")));
});

test("check-theme CLI accepts an omitted or matching release tag", () => {
  for (const args of [[], ["--release-tag", "0.1.0"]]) {
    const result = runCli(args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Theme policy checks passed/);
  }
});

test("check-theme CLI rejects a mismatched release tag", () => {
  const result = runCli(["--release-tag", "1.0.0"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /^ERROR: release tag 1\.0\.0 must equal 0\.1\.0\n$/);
});

test("check-theme CLI rejects a release-tag option without a value", () => {
  for (const args of [["--release-tag"], ["--release-tag", "--other-option"]]) {
    const result = runCli(args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^ERROR: --release-tag requires a value\n$/);
  }
});

test("check-theme CLI reports missing JSON files without a stack trace", (t) => {
  const directory = createThemeFixture(t, { "manifest.json": null });
  const result = runCli([], directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /^ERROR: .+manifest\.json.+\n$/);
  assert.equal(result.stderr.trim().split("\n").length, 1);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test("check-theme CLI reports malformed JSON without a stack trace", (t) => {
  const directory = createThemeFixture(t, { "versions.json": "{broken json\n" });
  const result = runCli([], directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /^ERROR: .+versions\.json.+\n$/);
  assert.equal(result.stderr.trim().split("\n").length, 1);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test("check-theme CLI reports manifest schema errors for JSON null", (t) => {
  const directory = createThemeFixture(t, { "manifest.json": "null\n" });
  const result = runCli([], directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ERROR: manifest\.json must be a plain object/);
  assert.doesNotMatch(result.stderr, /Cannot read properties/);
});
