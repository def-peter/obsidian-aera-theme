import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
}

test("theme metadata is consistent", async () => {
  const manifest = await readJson("../manifest.json");
  const packageJson = await readJson("../package.json");
  const versions = await readJson("../versions.json");

  assert.equal(manifest.name, "Aera");
  assert.equal(manifest.author, "Peter");
  assert.equal(manifest.minAppVersion, "1.12.7");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.version, manifest.version);
  assert.equal(versions[manifest.version], manifest.minAppVersion);
});
