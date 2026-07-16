import assert from "node:assert/strict";
import test from "node:test";

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

test("validateVersions requires the current version to map to minAppVersion", () => {
  assert.deepEqual(validateVersions(validManifest, { "0.1.0": "1.12.7" }), []);

  const errors = validateVersions(validManifest, { "0.1.0": "1.12.6" });
  assert.ok(errors.some((error) => error.includes("versions.json")));
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

test("validateReleaseTag accepts an empty or matching release tag", () => {
  assert.deepEqual(validateReleaseTag(validManifest, ""), []);
  assert.deepEqual(validateReleaseTag(validManifest, "0.1.0"), []);
});

test("validateReleaseTag rejects a mismatched release tag", () => {
  const errors = validateReleaseTag(validManifest, "0.2.0");
  assert.ok(errors.some((error) => error.includes("0.2.0")));
});
