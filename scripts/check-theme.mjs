import { readFile } from "node:fs/promises";

import {
  validateCss,
  validateManifest,
  validateReleaseTag,
  validateVersions,
} from "./theme-policy.mjs";

async function readJson(path) {
  let contents;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`could not read ${path}: ${error.message}`);
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`could not parse ${path}: ${error.message}`);
  }
}

function readReleaseTag(args) {
  const tagIndex = args.indexOf("--release-tag");
  if (tagIndex === -1) return "";

  const tag = args[tagIndex + 1];
  if (!tag || tag.startsWith("--")) {
    throw new Error("--release-tag requires a value");
  }
  return tag;
}

async function main() {
  const tag = readReleaseTag(process.argv.slice(2));
  const manifest = await readJson("manifest.json");
  const packageJson = await readJson("package.json");
  const versions = await readJson("versions.json");
  const css = await readFile("theme.css", "utf8");
  const errors = [
    ...validateManifest(manifest),
    ...validateVersions(manifest, versions),
    ...validateCss(css),
    ...validateReleaseTag(manifest, tag),
  ];

  if (packageJson.version !== manifest?.version) {
    errors.push("package.json version must equal manifest version");
  }

  if (errors.length) {
    errors.forEach((error) => console.error(`ERROR: ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("Theme policy checks passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ERROR: ${message.replace(/\s+/g, " ").trim()}`);
  process.exitCode = 1;
});
