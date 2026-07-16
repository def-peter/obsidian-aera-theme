import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { linkVault } from "../scripts/link-vault.mjs";

const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const cliPath = join(repoRoot, "scripts/link-vault.mjs");
const fixtureNames = ["Theme Playground.md", "Embedded Note.md"];

async function createVault(t) {
  const vault = await mkdtemp(join(tmpdir(), "aera-vault-"));
  t.after(() => rm(vault, { recursive: true, force: true }));
  return vault;
}

async function themeLink(vault) {
  return join(vault, ".obsidian", "themes", "Aera");
}

test("linkVault links Aera and copies the playground fixtures", async (t) => {
  const vault = await createVault(t);

  await linkVault(vault, repoRoot);

  assert.equal(await readlink(await themeLink(vault)), repoRoot);
  for (const name of fixtureNames) {
    const expected = await readFile(join(repoRoot, "fixtures", name), "utf8");
    assert.equal(await readFile(join(vault, name), "utf8"), expected);
  }
});

test("the playground fixture covers the supported Markdown elements", async () => {
  const playground = await readFile(
    join(repoRoot, "fixtures", "Theme Playground.md"),
    "utf8",
  );
  const requiredPatterns = [
    /^---\nstatus: .+\ntopics:\n(?:  - .+\n)+published: .+\n---$/m,
    /^# .+$/m,
    /^## .+$/m,
    /^### .+$/m,
    /^#### .+$/m,
    /^##### .+$/m,
    /^###### .+$/m,
    /[\u3400-\u9fff].*English/,
    /\*\*[^*]+\*\*/,
    /(?<!\*)\*[^*]+\*(?!\*)/,
    /==[^=]+==/,
    /`[^`]+`/,
    /\[\[Embedded Note\]\]/,
    /\[\[Missing Note\]\]/,
    /\[[^\]]+\]\(https:\/\//,
    /^> (?!\[!).+$/m,
    /^\d+\. .+\n {3,}\d+\. .+$/m,
    /^- .+\n {2,}- .+$/m,
    /^- \[x\] .+$/m,
    /^- \[ \] .+$/m,
    /```css\n[\s\S]+?```/,
    /^---$/m,
    /^> \[!note\]/m,
    /^> \[!warning\]/m,
    /^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+/m,
    /#[\w/-]+/,
    /!\[\[Embedded Note\]\]/,
    /\[\^[^\]]+\].*\n\n\[\^[^\]]+\]:/s,
  ];

  for (const pattern of requiredPatterns) {
    assert.match(playground, pattern);
  }
});

test("linkVault is idempotent", async (t) => {
  const vault = await createVault(t);

  await linkVault(vault, repoRoot);
  await linkVault(vault, repoRoot);

  assert.equal(await realpath(await themeLink(vault)), await realpath(repoRoot));
  for (const name of fixtureNames) {
    assert.equal(
      await readFile(join(vault, name), "utf8"),
      await readFile(join(repoRoot, "fixtures", name), "utf8"),
    );
  }
});

test("linkVault accepts an existing symlink to the same repository", async (t) => {
  const vault = await createVault(t);
  const link = await themeLink(vault);
  await mkdir(dirname(link), { recursive: true });
  await symlink(repoRoot, link, "dir");

  await linkVault(vault, repoRoot);

  assert.equal(await readlink(link), repoRoot);
});

test("linkVault rejects an existing ordinary directory without deleting it", async (t) => {
  const vault = await createVault(t);
  const link = await themeLink(vault);
  const marker = join(link, "keep.txt");
  await mkdir(link, { recursive: true });
  await writeFile(marker, "keep me\n");

  await assert.rejects(linkVault(vault, repoRoot), /refus|already exists|symlink/i);

  assert.equal((await lstat(link)).isDirectory(), true);
  assert.equal(await readFile(marker, "utf8"), "keep me\n");
});

test("linkVault rejects an existing ordinary file without deleting it", async (t) => {
  const vault = await createVault(t);
  const link = await themeLink(vault);
  await mkdir(dirname(link), { recursive: true });
  await writeFile(link, "keep me\n");

  await assert.rejects(linkVault(vault, repoRoot), /refus|already exists|symlink/i);

  assert.equal((await lstat(link)).isFile(), true);
  assert.equal(await readFile(link, "utf8"), "keep me\n");
});

test("linkVault rejects a symlink to another directory without deleting it", async (t) => {
  const vault = await createVault(t);
  const otherDirectory = await mkdtemp(join(tmpdir(), "aera-other-"));
  t.after(() => rm(otherDirectory, { recursive: true, force: true }));
  const link = await themeLink(vault);
  await mkdir(dirname(link), { recursive: true });
  await symlink(otherDirectory, link, "dir");

  await assert.rejects(linkVault(vault, repoRoot), /refus|different|symlink/i);

  assert.equal((await lstat(link)).isSymbolicLink(), true);
  assert.equal(await readlink(link), otherDirectory);
});

test("linkVault rejects a broken symlink without deleting it", async (t) => {
  const vault = await createVault(t);
  const link = await themeLink(vault);
  const missingTarget = join(vault, "missing-theme");
  await mkdir(dirname(link), { recursive: true });
  await symlink(missingTarget, link, "dir");

  await assert.rejects(linkVault(vault, repoRoot), /broken|dangling/i);

  assert.equal((await lstat(link)).isSymbolicLink(), true);
  assert.equal(await readlink(link), missingTarget);
});

test("linkVault resolves vault and repository symlink aliases", async (t) => {
  const directory = await createVault(t);
  const vault = join(directory, "vault");
  const vaultAlias = join(directory, "vault-alias");
  const repoAlias = join(directory, "repo-alias");
  await mkdir(vault);
  await symlink(vault, vaultAlias, "dir");
  await symlink(repoRoot, repoAlias, "dir");

  await linkVault(vaultAlias, repoAlias);

  assert.equal(await readlink(await themeLink(vault)), await realpath(repoRoot));
});

test("linkVault requires AERA_TEST_VAULT", async () => {
  await assert.rejects(
    linkVault(undefined, repoRoot),
    /AERA_TEST_VAULT is required/,
  );
});

test("link-vault CLI reports a missing vault without a stack trace", () => {
  const result = spawnSync(process.execPath, [cliPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, AERA_TEST_VAULT: "" },
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^ERROR: AERA_TEST_VAULT is required\n$/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
});

test("link-vault CLI prints the linked vault path", async (t) => {
  const vault = await createVault(t);
  const result = spawnSync(process.execPath, [cliPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, AERA_TEST_VAULT: vault },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, `Aera linked into ${await realpath(vault)}\n`);
});

test("link-vault CLI keeps success output on one line", async (t) => {
  const directory = await createVault(t);
  const vault = join(directory, "vault\npath");
  await mkdir(vault);
  const result = spawnSync(process.execPath, [cliPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, AERA_TEST_VAULT: vault },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.trim().split("\n").length, 1);
});
