import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
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

import {
  copyFixtureSafely,
  linkTypeForPlatform,
  linkVault,
  verifyThemeLink,
} from "../scripts/link-vault.mjs";

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

test("linkTypeForPlatform uses junctions only on Windows", () => {
  assert.equal(linkTypeForPlatform("win32"), "junction");
  assert.equal(linkTypeForPlatform("darwin"), "dir");
  assert.equal(linkTypeForPlatform("linux"), "dir");
});

test("verifyThemeLink rejects a final link that no longer points to the repository", async (t) => {
  const vault = await createVault(t);
  const otherDirectory = await mkdtemp(join(tmpdir(), "aera-final-link-"));
  t.after(() => rm(otherDirectory, { recursive: true, force: true }));
  const link = await themeLink(vault);
  await mkdir(dirname(link), { recursive: true });
  await symlink(otherDirectory, link, "dir");

  await assert.rejects(
    verifyThemeLink(link, await realpath(repoRoot)),
    /verification failed.*does not point to the repository/i,
  );
});

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
  assert.match(
    playground,
    /^---\nstatus: active\ntopics:\n  - obsidian\n  - theme\npublished: 2026-07-16\n---\n/,
  );
  assert.match(playground, /^# Aera 主题演练场$/m);
  assert.match(playground, /^## 链接$/m);
  assert.match(playground, /^### 列表与引用$/m);
  assert.match(playground, /^#### 代码$/m);
  assert.match(playground, /^##### 标注框$/m);
  assert.match(playground, /^###### 表格、标签、嵌入与脚注$/m);
  assert.match(playground, /^中文排版与少量 English typography .+$/m);
  assert.match(
    playground,
    /^正文包含普通文字、\*\*粗体文字\*\*、\*斜体文字\*、==高亮文字== 与 `行内代码`。$/m,
  );
  assert.match(playground, /^已解析链接：\[\[Embedded Note\]\]$/m);
  assert.match(playground, /^未解析链接：\[\[Missing Note\]\]$/m);
  assert.match(playground, /^外部链接：\[Obsidian\]\(https:\/\/obsidian\.md\)$/m);
  assert.match(playground, /^> 这是一段用于检查节奏、边框和弱化文字的普通引用。$/m);
  assert.match(playground, /^1\. 有序列表项$/m);
  assert.match(playground, /^   1\. 嵌套有序列表项$/m);
  assert.match(playground, /^2\. 另一个有序列表项$/m);
  assert.match(playground, /^- 无序列表项$/m);
  assert.match(playground, /^  - 嵌套无序列表项$/m);
  assert.match(playground, /^- 另一个无序列表项$/m);
  assert.match(playground, /^- \[x\] 已完成任务$/m);
  assert.match(playground, /^- \[ \] 待完成任务$/m);
  assert.match(playground, /^```css\n[\s\S]+?^```$/m);
  assert.equal(playground.match(/^---$/gm)?.length, 3);
  assert.match(playground, /^```\n\n---\n\n##### 标注框$/m);
  assert.match(playground, /^> \[!note\] 提示$/m);
  assert.match(playground, /^> 这是一条平静的补充信息。$/m);
  assert.match(playground, /^> \[!warning\] 警告$/m);
  assert.match(playground, /^> 此处内容需要重点关注。$/m);
  assert.match(playground, /^\| 元素 \| 状态 \| 用途 \|$/m);
  assert.match(playground, /^\| --- \| --- \| --- \|$/m);
  assert.match(playground, /^\| 链接 \| 已解析 \| 导航 \|$/m);
  assert.match(playground, /^\| 任务 \| 待完成 \| 交互 \|$/m);
  assert.match(playground, /^#Aera主题 #视觉检查$/m);
  assert.match(playground, /^!\[\[Embedded Note\]\]$/m);
  assert.match(playground, /^演练场以脚注引用结束。\[\^aera\]$/m);
  assert.match(playground, /^\[\^aera\]: Aera 是用于检查 Obsidian 主题的演练 fixture。$/m);

  const embedded = await readFile(
    join(repoRoot, "fixtures", "Embedded Note.md"),
    "utf8",
  );
  assert.match(embedded, /^# 嵌入内容$/m);
  assert.match(embedded, /^这是一篇用于验证 `\[\[Embedded Note\]\]` 已解析内部链接与嵌入预览的中文笔记。$/m);
  assert.match(embedded, /^返回 \[\[Theme Playground\]\]。$/m);
});

for (const fixtureName of fixtureNames) {
  test(`linkVault rejects a ${fixtureName} symlink without writing outside the vault`, async (t) => {
    const vault = await createVault(t);
    const externalDirectory = await mkdtemp(join(tmpdir(), "aera-external-"));
    t.after(() => rm(externalDirectory, { recursive: true, force: true }));
    const externalFile = join(externalDirectory, fixtureName);
    const fixturePath = join(vault, fixtureName);
    await writeFile(externalFile, "outside content\n");
    await symlink(externalFile, fixturePath);

    await assert.rejects(linkVault(vault, repoRoot), /fixture|symlink|refus/i);

    assert.equal(await readFile(externalFile, "utf8"), "outside content\n");
    assert.equal((await lstat(fixturePath)).isSymbolicLink(), true);
    assert.equal(
      (await readdir(vault)).some((name) => /aera.*tmp|\.tmp/i.test(name)),
      false,
    );
  });
}

test("linkVault rejects a fixture directory without leaving a temporary file", async (t) => {
  const vault = await createVault(t);
  const fixturePath = join(vault, fixtureNames[0]);
  await mkdir(fixturePath);

  await assert.rejects(linkVault(vault, repoRoot), /fixture|directory|refus/i);

  assert.equal((await lstat(fixturePath)).isDirectory(), true);
  assert.equal(
    (await readdir(vault)).some((name) => /aera.*tmp|\.tmp/i.test(name)),
    false,
  );
});

test("copyFixtureSafely preserves the destination and removes its temporary file after failure", async (t) => {
  const vault = await createVault(t);
  const destination = join(vault, "Fixture.md");
  await writeFile(destination, "original content\n");

  await assert.rejects(
    copyFixtureSafely(join(vault, "missing-source.md"), destination),
    /ENOENT|no such file/i,
  );

  assert.equal(await readFile(destination, "utf8"), "original content\n");
  assert.deepEqual(await readdir(vault), ["Fixture.md"]);
});

test("copyFixtureSafely never removes a conflicting temporary file it does not own", async (t) => {
  const vault = await createVault(t);
  const source = join(vault, "Source.md");
  const destination = join(vault, "Fixture.md");
  const temporaryId = "owned-by-another-process";
  const conflictingTemporaryFile = join(
    vault,
    `.Fixture.md.aera-${temporaryId}.tmp`,
  );
  await writeFile(source, "new content\n");
  await writeFile(destination, "original content\n");
  await writeFile(conflictingTemporaryFile, "other process content\n");

  await assert.rejects(
    copyFixtureSafely(source, destination, {
      createTemporaryId: () => temporaryId,
    }),
    /EEXIST|already exists/i,
  );

  assert.equal(await readFile(destination, "utf8"), "original content\n");
  assert.equal(
    await readFile(conflictingTemporaryFile, "utf8"),
    "other process content\n",
  );
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
  assert.equal(
    result.stdout,
    `Aera linked into ${(await realpath(vault)).replace("\n", " ")}\n`,
  );
});

test("link-vault CLI preserves ordinary consecutive spaces", async (t) => {
  const directory = await createVault(t);
  const vault = join(directory, "vault  path");
  await mkdir(vault);
  const result = spawnSync(process.execPath, [cliPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, AERA_TEST_VAULT: vault },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, `Aera linked into ${await realpath(vault)}\n`);
});
