import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, repoRoot), "utf8");
}

test("README documents Aera development and release essentials", async () => {
  const readme = await read("README.md");

  assert.match(readme, /^# Aera$/m);
  assert.match(readme, /A quiet interface for clear thinking\./);
  assert.match(readme, /Chinese-first/i);
  assert.match(readme, /!\[[^\]]*Aera[^\]]*\]\(preview\.png\)/i);
  for (const command of [
    "npm install",
    "npm run build",
    "npm run check",
    "npm run link:vault",
    "npm run dev",
  ]) {
    assert.match(readme, new RegExp(`\\b${command.replaceAll(" ", "\\s+")}\\b`));
  }
  assert.match(readme, /AERA_TEST_VAULT/);
  assert.match(readme, /manifest[^\n]*restart/i);
  assert.match(readme, /CSS[^\n]*auto(?:matically)?[^\n]*reload/i);
  assert.match(readme, /manifest\.json[^\n]*theme\.css/);
  assert.match(readme, /\[MIT\]\(LICENSE\)/);
});

test("checks workflow runs repository checks on pushes and pull requests", async () => {
  const workflow = await read(".github/workflows/checks.yml");

  assert.match(workflow, /^name: Checks$/m);
  assert.match(workflow, /^on:\s*\[push, pull_request\]$/m);
  assert.match(workflow, /^permissions:\n  contents: read$/m);
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /cache: npm/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run check/);
  assert.match(workflow, /run: git diff --exit-code -- theme\.css/);
});

test("release workflow validates tags and creates a draft with theme assets", async () => {
  const workflow = await read(".github/workflows/release.yml");

  assert.match(workflow, /^name: Release Obsidian theme$/m);
  assert.match(workflow, /^on:\n  push:\n    tags: \["\*"\]$/m);
  assert.match(workflow, /^permissions:\n  contents: write$/m);
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /cache: npm/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run check/);
  assert.match(
    workflow,
    /node scripts\/check-theme\.mjs --release-tag "\$GITHUB_REF_NAME"/,
  );
  assert.match(workflow, /run: git diff --exit-code -- theme\.css/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(
    workflow,
    /gh release create "\$GITHUB_REF_NAME" --title "\$GITHUB_REF_NAME" --generate-notes --draft manifest\.json theme\.css/,
  );
});
