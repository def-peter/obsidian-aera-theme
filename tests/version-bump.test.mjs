import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { bumpMetadata } from "../scripts/version-bump.mjs";

const manifest = {
  name: "Aera",
  version: "0.1.0",
  minAppVersion: "1.12.7",
  author: "Peter",
  authorUrl: "https://example.com/peter",
};
const versions = { "0.1.0": "1.12.7" };
const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const cliPath = join(repoRoot, "scripts/version-bump.mjs");

function createFixture(t, packageVersion) {
  const directory = mkdtempSync(join(tmpdir(), "aera-version-bump-"));
  writeFileSync(
    join(directory, "package.json"),
    `${JSON.stringify({ version: packageVersion }, null, 2)}\n`,
  );
  writeFileSync(
    join(directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(
    join(directory, "versions.json"),
    `${JSON.stringify(versions, null, 2)}\n`,
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function runCli(cwd) {
  return spawnSync(process.execPath, [cliPath], { cwd, encoding: "utf8" });
}

test("bumpMetadata updates the manifest and appends the versions mapping", () => {
  assert.deepEqual(bumpMetadata(manifest, versions, "1.0.0"), {
    manifest: { ...manifest, version: "1.0.0" },
    versions: {
      "0.1.0": "1.12.7",
      "1.0.0": "1.12.7",
    },
  });
});

test("bumpMetadata does not mutate its inputs", () => {
  const manifestInput = structuredClone(manifest);
  const versionsInput = structuredClone(versions);
  const originalManifest = structuredClone(manifestInput);
  const originalVersions = structuredClone(versionsInput);

  const result = bumpMetadata(manifestInput, versionsInput, "1.0.0");

  assert.deepEqual(manifestInput, originalManifest);
  assert.deepEqual(versionsInput, originalVersions);
  assert.notStrictEqual(result.manifest, manifestInput);
  assert.notStrictEqual(result.versions, versionsInput);
});

test("bumpMetadata rejects invalid target versions", () => {
  for (const target of ["1.0", "01.0.0", "v1.0.0", "", null]) {
    assert.throws(
      () => bumpMetadata(manifest, versions, target),
      /target version must use x\.y\.z/,
    );
  }
});

test("bumpMetadata rejects invalid manifest and versions inputs", () => {
  for (const invalidManifest of [null, [], { ...manifest, name: "Other" }]) {
    assert.throws(
      () => bumpMetadata(invalidManifest, versions, "1.0.0"),
      /manifest\.json/,
    );
  }

  for (const invalidVersions of [null, [], { "0.1.0": "1.12" }]) {
    assert.throws(
      () => bumpMetadata(manifest, invalidVersions, "1.0.0"),
      /versions\.json/,
    );
  }
});

test("version bump CLI syncs metadata to package.json version", (t) => {
  const directory = createFixture(t, "1.0.0");

  const result = runCli(directory);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "Theme metadata version synchronized\n");
  assert.equal(
    readFileSync(join(directory, "manifest.json"), "utf8"),
    `${JSON.stringify({ ...manifest, version: "1.0.0" }, null, 2)}\n`,
  );
  assert.equal(
    readFileSync(join(directory, "versions.json"), "utf8"),
    `${JSON.stringify({ ...versions, "1.0.0": "1.12.7" }, null, 2)}\n`,
  );
});

test("version bump CLI reports invalid metadata without modifying files", (t) => {
  const directory = createFixture(t, "1.0");
  const manifestPath = join(directory, "manifest.json");
  const versionsPath = join(directory, "versions.json");
  const originalManifest = readFileSync(manifestPath, "utf8");
  const originalVersions = readFileSync(versionsPath, "utf8");

  const result = runCli(directory);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /^ERROR: target version must use x\.y\.z\n$/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
  assert.equal(readFileSync(manifestPath, "utf8"), originalManifest);
  assert.equal(readFileSync(versionsPath, "utf8"), originalVersions);
});
