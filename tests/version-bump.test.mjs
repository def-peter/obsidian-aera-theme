import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

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

function runCliAsync(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath], { cwd });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status, signal) => {
      resolve({ status, signal, stdout, stderr });
    });
  });
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

test("version bump CLI reports rollback failures and preserves their backups", (t) => {
  const directory = createFixture(t, "1.0.0");
  const preloadPath = join(directory, "fail-renames.mjs");
  writeFileSync(
    preloadPath,
    `import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { basename } from "node:path";

const realRename = fs.promises.rename;
const realRm = fs.promises.rm;
let installFailed = false;
let rollbackFailed = false;
let cleanupFailed = false;
fs.promises.rename = async (source, destination) => {
  const sourceName = basename(String(source));
  const destinationName = basename(String(destination));
  if (!installFailed && sourceName.startsWith(".versions.json.aera-") && sourceName.endsWith(".tmp")) {
    installFailed = true;
    throw new Error("injected versions install failure");
  }
  if (!rollbackFailed && sourceName.startsWith(".manifest.json.aera-") && sourceName.endsWith(".bak") && destinationName === "manifest.json") {
    rollbackFailed = true;
    throw new Error("injected manifest rollback failure");
  }
  return realRename(source, destination);
};
fs.promises.rm = async (path, options) => {
  const name = basename(String(path));
  if (!cleanupFailed && name.startsWith(".versions.json.aera-") && name.endsWith(".tmp")) {
    cleanupFailed = true;
    throw new Error("injected temporary cleanup failure");
  }
  return realRm(path, options);
};
syncBuiltinESMExports();
`,
  );

  const result = spawnSync(
    process.execPath,
    ["--import", pathToFileURL(preloadPath).href, cliPath],
    { cwd: directory, encoding: "utf8" },
  );
  const backupName = readdirSync(directory).find((name) =>
    /^\.manifest\.json\.aera-.+\.bak$/.test(name),
  );
  const temporaryName = readdirSync(directory).find((name) =>
    /^\.versions\.json\.aera-.+\.tmp$/.test(name),
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /injected versions install failure/);
  assert.match(result.stderr, /rollback.*injected manifest rollback failure/i);
  assert.match(result.stderr, /cleanup.*injected temporary cleanup failure/i);
  assert.ok(backupName, "failed rollback should preserve the manifest backup");
  assert.ok(temporaryName, "failed cleanup should preserve the versions temporary file");
  assert.match(result.stderr, new RegExp(backupName.replaceAll(".", "\\.")));
  assert.match(result.stderr, new RegExp(temporaryName.replaceAll(".", "\\.")));
  assert.equal(existsSync(join(directory, "manifest.json")), false);
});

test("version bump CLI serializes concurrent calls in the same directory", async (t) => {
  const directory = createFixture(t, "1.0.0");
  const results = await Promise.all(
    Array.from({ length: 24 }, () => runCliAsync(directory)),
  );

  for (const result of results) {
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "Theme metadata version synchronized\n");
  }
  assert.equal(
    readFileSync(join(directory, "manifest.json"), "utf8"),
    `${JSON.stringify({ ...manifest, version: "1.0.0" }, null, 2)}\n`,
  );
  assert.equal(
    readFileSync(join(directory, "versions.json"), "utf8"),
    `${JSON.stringify({ ...versions, "1.0.0": "1.12.7" }, null, 2)}\n`,
  );
  assert.deepEqual(readdirSync(directory).sort(), [
    "manifest.json",
    "package.json",
    "versions.json",
  ]);
});
