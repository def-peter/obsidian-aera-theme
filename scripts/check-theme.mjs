import { readFile } from "node:fs/promises";

import {
  validateCss,
  validateManifest,
  validateReleaseTag,
  validateVersions,
} from "./theme-policy.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const manifest = await readJson("manifest.json");
const packageJson = await readJson("package.json");
const versions = await readJson("versions.json");
const css = await readFile("theme.css", "utf8");

const tagIndex = process.argv.indexOf("--release-tag");
const tag = tagIndex === -1 ? "" : process.argv[tagIndex + 1];
const errors = [
  ...validateManifest(manifest),
  ...validateVersions(manifest, versions),
  ...validateCss(css),
  ...validateReleaseTag(manifest, tag),
];

if (packageJson.version !== manifest.version) {
  errors.push("package.json version must equal manifest version");
}

if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}

console.log("Theme policy checks passed");
