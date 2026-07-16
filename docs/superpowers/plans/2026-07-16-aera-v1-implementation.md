# Aera v1 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 构建 Aera 1.0.0 Obsidian 主题，以官方 CSS 变量为主实现中文优先的完整正文体验、明暗模式、移动端兼容、真实应用预览和可发布产物。

**架构：** 使用模块化 SCSS 管理颜色、排版、正文元素与组件，Dart Sass 编译为根目录唯一发行样式 `theme.css`。Node 内置测试运行器与 PostCSS 验证 Manifest、版本、CSS 变量、禁止模式和颜色对比度；专用测试 Vault 通过符号链接实时加载当前仓库。

**技术栈：** SCSS、Dart Sass 1.101.0、PostCSS 8.5.19、Node.js 24、Node Test Runner、Obsidian 1.12.7 CLI、GitHub Actions

---

## 实现依据

- 设计规格：`docs/superpowers/specs/2026-07-16-aera-theme-design.md`
- [官方 Manifest](https://docs.obsidian.md/Reference/Manifest)
- [官方 CSS 变量](https://docs.obsidian.md/Reference/CSS+variables/CSS+variables)
- [官方主题规范](https://docs.obsidian.md/Themes/App+themes/Theme+guidelines)
- [官方发布流程](https://docs.obsidian.md/Themes/App+themes/Release+your+theme+with+GitHub+Actions)

## 文件结构与职责

| 路径 | 职责 |
| --- | --- |
| `package.json` | 版本、构建、测试、校验和 Vault 链接命令 |
| `manifest.json` / `versions.json` | 主题元数据和版本映射 |
| `src/theme.scss` | Sass 唯一入口 |
| `src/foundations/*.scss` | 明暗颜色、排版和共享间距 |
| `src/editor/*.scss` | 标题、行内、列表、引用和代码 |
| `src/components/*.scss` | Callout、表格、Properties、嵌入和标签 |
| `scripts/*.mjs` | 政策、对比度、版本和测试 Vault 工具 |
| `tests/*.test.mjs` | 元数据、政策、Tokens 与组件回归测试 |
| `fixtures/*.md` | 固定主题测试笔记 |
| `.github/workflows/*.yml` | push、PR 与 tag 自动化 |
| `theme.css` | Sass 生成并提交的正式发行文件 |
| `screenshot.png` | Community Themes 的 512×288 预览图 |

`src/platforms/_mobile.scss` 不预先创建。只有真实移动端模拟复现明确问题、添加失败断言并确认官方变量不足时，才创建并加载。

## 任务 1：建立元数据与 Sass 构建骨架

**文件：**
- 创建：`package.json`、`manifest.json`、`versions.json`
- 创建：`src/theme.scss`、`tests/metadata.test.mjs`
- 生成：`package-lock.json`、`theme.css`

- [ ] **步骤 1：创建 package 文件和失败的元数据测试**

`package.json`：

```json
{
  "name": "obsidian-aera-theme",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "sass --watch --no-source-map --style=expanded --no-error-css src/theme.scss:theme.css",
    "build": "sass --no-source-map --style=expanded --no-error-css src/theme.scss theme.css",
    "test": "node --test",
    "check": "npm run build && node --test && node scripts/check-theme.mjs && node scripts/contrast.mjs"
  },
  "devDependencies": {
    "postcss": "8.5.19",
    "sass": "1.101.0"
  }
}
```

`tests/metadata.test.mjs`：

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

test("metadata is coherent and targets tested Obsidian", async () => {
  const manifest = await readJson("manifest.json");
  const pkg = await readJson("package.json");
  const versions = await readJson("versions.json");
  assert.equal(manifest.name, "Aera");
  assert.equal(manifest.author, "Peter");
  assert.equal(manifest.minAppVersion, "1.12.7");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.version, manifest.version);
  assert.equal(versions[manifest.version], manifest.minAppVersion);
});
```

- [ ] **步骤 2：安装依赖并确认测试失败**

运行 `npm install && npm test`。

预期：FAIL，错误包含 `ENOENT` 和 `manifest.json`。

- [ ] **步骤 3：创建元数据和入口**

`manifest.json`：

```json
{
  "name": "Aera",
  "version": "0.1.0",
  "minAppVersion": "1.12.7",
  "author": "Peter"
}
```

`versions.json`：

```json
{
  "0.1.0": "1.12.7"
}
```

`src/theme.scss`：

```scss
/* Aera - A quiet interface for clear thinking. */
```

- [ ] **步骤 4：构建并验证**

运行 `npm run build && npm test`。

预期：生成 `theme.css`；测试输出 `1 pass, 0 fail`。

- [ ] **步骤 5：提交**

```bash
git add package.json package-lock.json manifest.json versions.json src/theme.scss theme.css tests/metadata.test.mjs
git commit -m "build: scaffold Aera theme"
```

## 任务 2：用测试锁定主题政策

**文件：**
- 创建：`scripts/theme-policy.mjs`、`scripts/check-theme.mjs`
- 创建：`tests/theme-policy.test.mjs`

- [ ] **步骤 1：编写失败的政策测试**

`tests/theme-policy.test.mjs`：

```js
import assert from "node:assert/strict";
import test from "node:test";
import { validateCss, validateManifest, validateReleaseTag, validateVersions } from "../scripts/theme-policy.mjs";

const manifest = { name: "Aera", version: "0.1.0", minAppVersion: "1.12.7", author: "Peter" };

test("accepts supported metadata", () => assert.deepEqual(validateManifest(manifest), []));
test("rejects plugin-only fields", () => assert.match(validateManifest({ ...manifest, description: "quiet" }).join("\n"), /description/));
test("requires versions mapping", () => {
  assert.deepEqual(validateVersions(manifest, { "0.1.0": "1.12.7" }), []);
  assert.match(validateVersions(manifest, {}).join("\n"), /versions.json/);
});
test("rejects forbidden CSS", () => {
  const css = "body{--font-text-size:18px!important;--file-line-width:700px}.x:has(.y){background:url(https://x.test/a)}";
  const output = validateCss(css).join("\n");
  for (const text of ["!important", ":has", "remote URL", "--font-text-size", "--file-line-width"]) assert.ok(output.includes(text));
});
test("requires matching release tag", () => {
  assert.deepEqual(validateReleaseTag(manifest, "0.1.0"), []);
  assert.match(validateReleaseTag(manifest, "1.0.0").join("\n"), /tag/);
});
```

- [ ] **步骤 2：运行 `node --test tests/theme-policy.test.mjs`，确认 FAIL `ERR_MODULE_NOT_FOUND`。**

- [ ] **步骤 3：实现政策函数**

`scripts/theme-policy.mjs`：

```js
const allowedKeys = new Set(["author", "authorUrl", "fundingUrl", "minAppVersion", "name", "version"]);
const semver = /^\d+\.\d+\.\d+$/;

export function validateManifest(manifest) {
  const errors = [];
  for (const key of ["author", "minAppVersion", "name", "version"]) {
    if (typeof manifest[key] !== "string" || !manifest[key]) errors.push(`manifest.json requires ${key}`);
  }
  for (const key of Object.keys(manifest)) if (!allowedKeys.has(key)) errors.push(`manifest.json does not support ${key}`);
  if (manifest.name !== "Aera") errors.push("theme name must remain Aera");
  if (!semver.test(manifest.version ?? "")) errors.push("manifest version must use x.y.z");
  if (!semver.test(manifest.minAppVersion ?? "")) errors.push("minAppVersion must use x.y.z");
  return errors;
}

export function validateVersions(manifest, versions) {
  return versions[manifest.version] === manifest.minAppVersion ? [] : ["versions.json must map manifest version to minAppVersion"];
}

export function validateCss(css) {
  const checks = [
    [/!important\b/i, "theme.css must not contain !important"],
    [/:has\s*\(/i, "theme.css must not contain :has()"],
    [/url\(\s*["']?https?:/i, "theme.css must not load a remote URL"],
    [/--font-text-size\s*:/i, "theme.css must not assign --font-text-size"],
    [/--file-line-width\s*:/i, "theme.css must not assign --file-line-width"],
    [/--font-interface-theme\s*:/i, "theme.css must not assign --font-interface-theme"],
    [/sourceMappingURL/i, "theme.css must not contain source map references"]
  ];
  return checks.filter(([pattern]) => pattern.test(css)).map(([, message]) => message);
}

export function validateReleaseTag(manifest, tag) {
  return !tag || tag === manifest.version ? [] : [`release tag ${tag} must equal ${manifest.version}`];
}
```

- [ ] **步骤 4：实现 CI CLI**

`scripts/check-theme.mjs`：

```js
import { readFile } from "node:fs/promises";
import { validateCss, validateManifest, validateReleaseTag, validateVersions } from "./theme-policy.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const manifest = await readJson("manifest.json");
const pkg = await readJson("package.json");
const versions = await readJson("versions.json");
const css = await readFile("theme.css", "utf8");
const tagIndex = process.argv.indexOf("--release-tag");
const tag = tagIndex === -1 ? "" : process.argv[tagIndex + 1];
const errors = [
  ...validateManifest(manifest),
  ...validateVersions(manifest, versions),
  ...validateCss(css),
  ...validateReleaseTag(manifest, tag)
];
if (pkg.version !== manifest.version) errors.push("package.json version must equal manifest version");
if (errors.length) {
  errors.forEach((error) => console.error(`ERROR: ${error}`));
  process.exit(1);
}
console.log("Theme policy checks passed");
```

- [ ] **步骤 5：验证并提交**

```bash
node --test tests/theme-policy.test.mjs
npm run build
node scripts/check-theme.mjs
git add scripts tests/theme-policy.test.mjs
git commit -m "test: enforce Obsidian theme policies"
```

预期：测试通过；CLI 输出 `Theme policy checks passed`。

## 任务 3：实现颜色、排版与对比度

**文件：**
- 创建：`tests/helpers/css.mjs`、`tests/foundations.test.mjs`
- 创建：`scripts/contrast.mjs`
- 创建：`src/foundations/_colors.scss`、`src/foundations/_typography.scss`
- 修改：`src/theme.scss`、`theme.css`

- [ ] **步骤 1：创建 PostCSS 帮助函数和失败的 Tokens 测试**

`tests/helpers/css.mjs`：

```js
import postcss from "postcss";

export function declarationsFor(css, selector) {
  const output = new Map();
  postcss.parse(css).walkRules((rule) => {
    if (rule.selector === selector) rule.walkDecls((decl) => output.set(decl.prop, decl.value));
  });
  return output;
}
```

`tests/foundations.test.mjs`：

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { contrastRatio } from "../scripts/contrast.mjs";
import { declarationsFor } from "./helpers/css.mjs";

const css = await readFile("theme.css", "utf8");
test("defines approved typography without user-owned variables", () => {
  const body = declarationsFor(css, "body");
  assert.match(body.get("--font-text-theme"), /Avenir Next/);
  assert.equal(body.get("--line-height-normal"), "1.8");
  assert.equal(body.get("--p-spacing"), "var(--size-4-3)");
  assert.equal(body.has("--font-text-size"), false);
  assert.equal(body.has("--file-line-width"), false);
});
test("defines approved light and dark anchors", () => {
  const light = declarationsFor(css, ".theme-light");
  const dark = declarationsFor(css, ".theme-dark");
  assert.equal(light.get("--color-base-00"), "#f7f8f6");
  assert.equal(light.get("--color-base-100"), "#28302c");
  assert.equal(dark.get("--color-base-00"), "#171c19");
  assert.equal(dark.get("--color-base-100"), "#dce4df");
});
test("core pairs meet WCAG AA", () => {
  for (const pair of [["#28302c", "#f7f8f6"], ["#68756d", "#f7f8f6"], ["#3f725b", "#f7f8f6"], ["#dce4df", "#171c19"], ["#95a39b", "#171c19"], ["#76b795", "#171c19"]]) {
    assert.ok(contrastRatio(...pair) >= 4.5);
  }
});
```

- [ ] **步骤 2：运行 `npm run build && node --test tests/foundations.test.mjs`，确认 FAIL `ERR_MODULE_NOT_FOUND`。**

- [ ] **步骤 3：实现对比度模块**

`scripts/contrast.mjs`：

```js
import { pathToFileURL } from "node:url";

const linear = (channel) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
export function relativeLuminance(hex) {
  const [r, g, b] = hex.slice(1).match(/../g).map((part) => linear(parseInt(part, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(foreground, background) {
  const [high, low] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}
const pairs = [
  ["light text", "#28302c", "#f7f8f6"], ["light muted", "#68756d", "#f7f8f6"],
  ["light accent", "#3f725b", "#f7f8f6"], ["dark text", "#dce4df", "#171c19"],
  ["dark muted", "#95a39b", "#171c19"], ["dark accent", "#76b795", "#171c19"]
];
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let failed = false;
  for (const [name, foreground, background] of pairs) {
    const ratio = contrastRatio(foreground, background);
    console.log(`${name}: ${ratio.toFixed(2)}:1`);
    if (ratio < 4.5) failed = true;
  }
  if (failed) process.exit(1);
}
```

- [ ] **步骤 4：实现颜色与排版 SCSS**

`src/foundations/_colors.scss`：

```scss
.theme-light {
  --color-base-00: #f7f8f6; --color-base-05: #f4f5f3; --color-base-10: #eff1ef;
  --color-base-20: #e8ebe8; --color-base-25: #dde2de; --color-base-30: #d1d7d2;
  --color-base-35: #c4cbc5; --color-base-40: #aeb7b0; --color-base-50: #8b958e;
  --color-base-60: #68756d; --color-base-70: #4e5b53; --color-base-100: #28302c;
  --background-primary: var(--color-base-00); --background-secondary: var(--color-base-10);
  --text-normal: var(--color-base-100); --text-muted: var(--color-base-60); --text-faint: var(--color-base-50);
  --text-highlight-bg: rgba(191, 168, 68, 0.26);
  --accent-h: 152.9; --accent-s: 28.8%; --accent-l: 34.7%;
}
.theme-dark {
  --color-base-00: #171c19; --color-base-05: #1a201c; --color-base-10: #202720;
  --color-base-20: #262e29; --color-base-25: #2d3630; --color-base-30: #364139;
  --color-base-35: #414d45; --color-base-40: #526058; --color-base-50: #6d7b72;
  --color-base-60: #95a39b; --color-base-70: #bbc7c0; --color-base-100: #dce4df;
  --background-primary: var(--color-base-00); --background-secondary: var(--color-base-10);
  --text-normal: var(--color-base-100); --text-muted: var(--color-base-60); --text-faint: var(--color-base-50);
  --text-highlight-bg: rgba(191, 168, 68, 0.28);
  --accent-h: 148.6; --accent-s: 31.1%; --accent-l: 59%;
}
```

`src/foundations/_typography.scss`：

```scss
body {
  --font-text-theme: "Avenir Next", Avenir, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  --font-monospace-theme: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  --line-height-normal: 1.8;
  --p-spacing: var(--size-4-3);
  --heading-spacing: var(--size-4-8);
  --bold-modifier: 200;
}
```

`src/theme.scss` 追加：

```scss
@use "foundations/colors";
@use "foundations/typography";
```

- [ ] **步骤 5：验证并提交**

```bash
npm run build
node --test tests/foundations.test.mjs
node scripts/contrast.mjs
node scripts/check-theme.mjs
git add src/foundations src/theme.scss theme.css scripts/contrast.mjs tests/helpers/css.mjs tests/foundations.test.mjs
git commit -m "feat: add Aera color and typography tokens"
```

预期：全部通过；对比度约为 `12.72`、`4.53`、`5.23`、`13.32`、`6.57`、`7.38`。

## 任务 4：实现标题与行内层级

**文件：**
- 创建：`tests/editor-inline.test.mjs`
- 创建：`src/editor/_headings.scss`、`src/editor/_inline.scss`
- 修改：`src/theme.scss`、`theme.css`

- [ ] **步骤 1：编写失败测试**

`tests/editor-inline.test.mjs`：

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { declarationsFor } from "./helpers/css.mjs";
const body = declarationsFor(await readFile("theme.css", "utf8"), "body");
test("defines relative heading hierarchy", () => {
  assert.equal(body.get("--inline-title-size"), "2em");
  assert.equal(body.get("--h1-size"), "1.85em");
  assert.equal(body.get("--h2-size"), "1.42em");
  assert.equal(body.get("--h6-color"), "var(--text-muted)");
});
test("derives links from user accent", () => {
  assert.equal(body.get("--link-color"), "var(--text-accent)");
  assert.equal(body.get("--link-decoration"), "none");
  assert.equal(body.get("--link-decoration-hover"), "underline");
  assert.equal(body.get("--link-unresolved-decoration-style"), "dotted");
});
```

- [ ] **步骤 2：运行 `npm run build && node --test tests/editor-inline.test.mjs`，确认变量为 `undefined`。**

- [ ] **步骤 3：实现标题和行内模块**

`src/editor/_headings.scss`：

```scss
body {
  --inline-title-color: var(--text-normal); --inline-title-font: var(--font-text-theme);
  --inline-title-line-height: 1.25; --inline-title-size: 2em; --inline-title-weight: 650;
  --h1-color: var(--text-normal); --h2-color: var(--text-normal); --h3-color: var(--text-normal);
  --h4-color: var(--text-normal); --h5-color: var(--text-normal); --h6-color: var(--text-muted);
  --h1-line-height: 1.28; --h2-line-height: 1.35; --h3-line-height: 1.4;
  --h4-line-height: 1.45; --h5-line-height: 1.5; --h6-line-height: 1.5;
  --h1-size: 1.85em; --h2-size: 1.42em; --h3-size: 1.16em;
  --h4-size: 1.05em; --h5-size: 1em; --h6-size: 0.9em;
  --h1-weight: 650; --h2-weight: 650; --h3-weight: 600;
  --h4-weight: 600; --h5-weight: 600; --h6-weight: 600;
}
```

`src/editor/_inline.scss`：

```scss
body {
  --bold-color: var(--text-normal); --italic-color: var(--text-normal);
  --link-color: var(--text-accent); --link-color-hover: var(--text-accent-hover);
  --link-decoration: none; --link-decoration-hover: underline; --link-decoration-thickness: 1px; --link-weight: 500;
  --link-unresolved-color: var(--text-muted); --link-unresolved-opacity: 1;
  --link-unresolved-decoration-style: dotted; --link-unresolved-decoration-color: var(--text-faint);
  --link-external-color: var(--text-accent); --link-external-color-hover: var(--text-accent-hover);
  --link-external-decoration: none; --link-external-decoration-hover: underline;
}
```

`src/theme.scss` 追加 `@use "editor/headings";` 和 `@use "editor/inline";`。

- [ ] **步骤 4：验证并提交**

```bash
npm run build
npm test
node scripts/check-theme.mjs
git add src/editor src/theme.scss theme.css tests/editor-inline.test.mjs
git commit -m "feat: style headings and inline content"
```

## 任务 5：实现列表、引用与代码块

**文件：**
- 创建：`tests/editor-blocks.test.mjs`
- 创建：`src/editor/_lists.scss`、`src/editor/_quotes.scss`、`src/editor/_code.scss`
- 修改：`src/theme.scss`、`theme.css`

- [ ] **步骤 1：编写失败测试**

`tests/editor-blocks.test.mjs`：

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { declarationsFor } from "./helpers/css.mjs";
const body = declarationsFor(await readFile("theme.css", "utf8"), "body");
test("styles lists and tasks through variables", () => {
  assert.equal(body.get("--list-spacing"), "var(--size-2-1)");
  assert.equal(body.get("--checkbox-radius"), "4px");
  assert.equal(body.get("--checklist-done-color"), "var(--text-faint)");
});
test("styles quotes and semantic code", () => {
  assert.equal(body.get("--blockquote-border-thickness"), "2px");
  assert.equal(body.get("--blockquote-background-color"), "transparent");
  assert.equal(body.get("--code-size"), "0.88em");
  assert.equal(body.get("--code-comment"), "var(--text-faint)");
});
```

- [ ] **步骤 2：运行目标测试，确认 `--list-spacing` 为 `undefined`。**

- [ ] **步骤 3：实现三个模块**

`src/editor/_lists.scss`：

```scss
body {
  --list-indent: 2em; --list-indent-editing: 0.75em; --list-spacing: var(--size-2-1);
  --list-marker-color: var(--text-muted); --list-marker-color-hover: var(--text-accent);
  --list-marker-color-collapsed: var(--text-accent); --list-bullet-border: 1px solid var(--text-muted);
  --list-bullet-radius: 50%; --list-bullet-size: 5px;
  --checkbox-radius: 4px; --checkbox-size: 16px; --checkbox-marker-color: var(--text-on-accent);
  --checkbox-color: var(--interactive-accent); --checkbox-color-hover: var(--interactive-accent-hover);
  --checkbox-border-color: var(--text-faint); --checkbox-border-color-hover: var(--text-muted);
  --checklist-done-decoration: line-through; --checklist-done-color: var(--text-faint);
}
```

`src/editor/_quotes.scss`：

```scss
body {
  --blockquote-background-color: transparent; --blockquote-border-thickness: 2px;
  --blockquote-border-color: var(--text-accent); --blockquote-font-style: normal;
  --blockquote-color: var(--text-muted); --hr-color: var(--background-modifier-border); --hr-thickness: 1px;
}
```

`src/editor/_code.scss`：

```scss
body {
  --code-background: var(--background-secondary); --code-white-space: pre; --code-size: 0.88em;
  --code-normal: var(--text-normal); --code-comment: var(--text-faint); --code-function: var(--color-blue);
  --code-important: var(--color-orange); --code-keyword: var(--text-accent); --code-operator: var(--text-muted);
  --code-property: var(--color-cyan); --code-punctuation: var(--text-muted); --code-string: var(--color-orange);
  --code-tag: var(--color-red); --code-value: var(--color-purple);
}
/* Obsidian has no code-block border or radius variable. */
.markdown-rendered pre {
  border: var(--border-width) solid var(--background-modifier-border);
  border-radius: 6px;
}
```

`src/theme.scss` 追加三个 `@use "editor/...";`。

- [ ] **步骤 4：验证并提交**

```bash
npm run build
npm test
node scripts/check-theme.mjs
git add src/editor src/theme.scss theme.css tests/editor-blocks.test.mjs
git commit -m "feat: style lists quotes and code"
```

预期：全部通过；编译 CSS 仅新增低权重选择器 `.markdown-rendered pre`。

## 任务 6：实现完整正文组件

**文件：**
- 创建：`tests/components.test.mjs`
- 创建：`src/foundations/_spacing.scss`
- 创建：`src/components/_callouts.scss`、`_tables.scss`、`_metadata.scss`、`_embeds.scss`、`_tags.scss`
- 修改：`src/theme.scss`、`theme.css`

- [ ] **步骤 1：编写失败测试**

`tests/components.test.mjs`：

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { declarationsFor } from "./helpers/css.mjs";
const body = declarationsFor(await readFile("theme.css", "utf8"), "body");
test("styles callouts without replacing semantic colors", () => {
  assert.equal(body.get("--callout-radius"), "6px");
  assert.equal(body.get("--callout-border-width"), "1px");
  assert.equal(body.has("--callout-warning"), false);
});
test("styles tables metadata embeds tags and footnotes", () => {
  assert.equal(body.get("--table-border-width"), "1px");
  assert.equal(body.get("--metadata-border-width"), "0px");
  assert.equal(body.get("--embed-border-start"), "2px solid var(--background-modifier-border)");
  assert.equal(body.get("--tag-radius"), "4px");
  assert.equal(body.get("--footnote-size"), "var(--font-smallest)");
});
```

- [ ] **步骤 2：运行目标测试，确认 `--callout-radius` 为 `undefined`。**

- [ ] **步骤 3：实现共享间距与组件模块**

`src/foundations/_spacing.scss`：

```scss
body {
  --callout-padding: var(--size-4-3) var(--size-4-4); --callout-title-padding: 0;
  --callout-content-padding: var(--size-4-2) 0 0; --metadata-gap: var(--size-2-3);
  --metadata-property-padding: var(--size-2-3) var(--size-4-2);
  --embed-padding: 0 0 0 var(--size-4-4); --tag-padding-x: var(--size-2-3); --tag-padding-y: var(--size-2-1);
}
```

`src/components/_callouts.scss`：

```scss
body {
  --callout-border-width: 1px; --callout-border-opacity: 0.25; --callout-radius: 6px;
  --callout-blend-mode: normal; --callout-title-size: var(--font-small);
  --callout-title-weight: 600; --callout-content-background: transparent;
}
```

`src/components/_tables.scss`：

```scss
body {
  --table-background: transparent; --table-border-width: 1px; --table-border-color: var(--background-modifier-border);
  --table-cell-vertical-alignment: top; --table-white-space: normal; --table-header-background: var(--background-secondary);
  --table-header-background-hover: var(--background-modifier-hover); --table-header-border-width: 1px;
  --table-header-border-color: var(--background-modifier-border); --table-header-size: var(--font-small);
  --table-header-weight: 600; --table-header-color: var(--text-muted); --table-line-height: 1.5;
  --table-text-size: var(--font-small); --table-text-color: var(--text-normal);
  --table-row-background-hover: var(--background-modifier-hover); --table-selection-border-color: var(--interactive-accent);
  --table-selection-border-width: 1px; --table-selection-border-radius: 4px;
}
```

`src/components/_metadata.scss`：

```scss
body {
  --metadata-background: transparent; --metadata-border-color: transparent; --metadata-border-radius: 0;
  --metadata-border-width: 0px; --metadata-divider-color: var(--background-modifier-border);
  --metadata-divider-color-hover: var(--background-modifier-border-hover); --metadata-divider-color-focus: var(--interactive-accent);
  --metadata-divider-width: 1px; --metadata-property-radius: 4px; --metadata-property-radius-hover: 4px;
  --metadata-property-radius-focus: 4px; --metadata-label-font-size: var(--font-smallest);
  --metadata-label-font-weight: 500; --metadata-label-text-color: var(--text-faint);
  --metadata-input-font-size: var(--font-small); --metadata-input-text-color: var(--text-normal);
  --metadata-input-background: transparent;
}
```

`src/components/_embeds.scss`：

```scss
body {
  --embed-background: transparent; --embed-border-start: 2px solid var(--background-modifier-border);
  --embed-border-end: 0; --embed-border-top: 0; --embed-border-bottom: 0;
  --embed-font-style: normal; --footnote-size: var(--font-smallest);
}
```

`src/components/_tags.scss`：

```scss
body {
  --tag-size: var(--font-smallest); --tag-color: var(--text-accent); --tag-color-hover: var(--text-accent-hover);
  --tag-decoration: none; --tag-decoration-hover: none; --tag-background: var(--background-secondary);
  --tag-background-hover: var(--background-modifier-hover); --tag-border-color: var(--background-modifier-border);
  --tag-border-color-hover: var(--background-modifier-border-hover); --tag-border-width: 1px;
  --tag-radius: 4px; --tag-weight: 500;
}
```

`src/theme.scss` 追加 `foundations/spacing` 与五个 `components/*` 的 `@use`。

- [ ] **步骤 4：验证并提交**

```bash
npm run build
npm test
node scripts/check-theme.mjs
git add src/foundations/_spacing.scss src/components src/theme.scss theme.css tests/components.test.mjs
git commit -m "feat: style complete note components"
```

预期：全部通过；Callout 类型色变量未被覆盖。

## 任务 7：建立固定测试笔记与 Vault 链接

**文件：**
- 创建：`fixtures/Theme Playground.md`、`fixtures/Embedded Note.md`
- 创建：`scripts/link-vault.mjs`、`tests/link-vault.test.mjs`
- 修改：`package.json`

- [ ] **步骤 1：编写失败的链接测试**

`tests/link-vault.test.mjs`：

```js
import assert from "node:assert/strict";
import { mkdtemp, readFile, readlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { linkVault } from "../scripts/link-vault.mjs";
test("links Aera and copies fixtures", async () => {
  const vault = await mkdtemp(path.join(os.tmpdir(), "aera-vault-"));
  await linkVault(vault, process.cwd());
  assert.equal(await readlink(path.join(vault, ".obsidian/themes/Aera")), process.cwd());
  assert.match(await readFile(path.join(vault, "Theme Playground.md"), "utf8"), /给思考留一点空气/);
  assert.match(await readFile(path.join(vault, "Embedded Note.md"), "utf8"), /嵌入内容/);
});
```

- [ ] **步骤 2：运行测试，确认 FAIL `ERR_MODULE_NOT_FOUND`。**

- [ ] **步骤 3：创建完整 Fixture**

`fixtures/Theme Playground.md`：

````markdown
---
status: growing
topics: [writing, attention]
published: false
---

# 给思考留一点空气

中文为主，并包含少量 English text。

## 行内元素

普通正文、**粗体**、*斜体*、==高亮==、`--text-normal`、[[Embedded Note|已解析链接]]、[[Missing Note|未解析链接]]、[外部链接](https://obsidian.md)。

> 安静不是没有声音，而是每一种声音都处在合适的位置。

### 列表与任务

1. 第一层
   1. 第二层
- 无序列表
  - 嵌套项目
- [x] 已完成任务
- [ ] 尚未完成的任务

#### 代码

```css
body { --line-height-normal: 1.8; }
```

---

##### Callout

> [!note] 提示
> 一次只推进一个判断。

> [!warning] 注意
> 语义色不应全部变成墨绿。

###### 表格、标签、嵌入与脚注

| 元素 | 作用 |
| --- | --- |
| 标题 | 建立方向 |
| 链接 | 延伸线索 |

#写作 #思考

![[Embedded Note]]

这是一条带脚注的句子。[^1]

[^1]: 脚注使用相对字号并继承正文色彩系统。
````

`fixtures/Embedded Note.md`：

```markdown
# 嵌入内容

嵌入内容保留来源边界，但不包装成独立浮层卡片。
```

- [ ] **步骤 4：实现幂等链接工具**

`scripts/link-vault.mjs`：

```js
import { copyFile, lstat, mkdir, readlink, symlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export async function linkVault(vaultPath, repoPath = process.cwd()) {
  if (!vaultPath) throw new Error("AERA_TEST_VAULT is required");
  const themes = path.join(vaultPath, ".obsidian", "themes");
  const link = path.join(themes, "Aera");
  await mkdir(themes, { recursive: true });
  try {
    const stat = await lstat(link);
    if (!stat.isSymbolicLink() || (await readlink(link)) !== repoPath) throw new Error(`${link} is not the expected Aera link`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await symlink(repoPath, link, "dir");
  }
  await copyFile(path.join(repoPath, "fixtures/Theme Playground.md"), path.join(vaultPath, "Theme Playground.md"));
  await copyFile(path.join(repoPath, "fixtures/Embedded Note.md"), path.join(vaultPath, "Embedded Note.md"));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await linkVault(process.env.AERA_TEST_VAULT);
  console.log(`Aera linked into ${process.env.AERA_TEST_VAULT}`);
}
```

在 `package.json` 增加 `"link:vault": "node scripts/link-vault.mjs"`。

- [ ] **步骤 5：验证并提交**

```bash
node --test tests/link-vault.test.mjs
npm run check
git add fixtures scripts/link-vault.mjs tests/link-vault.test.mjs package.json package-lock.json
git commit -m "test: add Obsidian theme playground"
```

## 任务 8：添加版本同步、README 与 CI

**文件：**
- 创建：`scripts/version-bump.mjs`、`tests/version-bump.test.mjs`
- 创建：`README.md`、`.github/workflows/checks.yml`、`.github/workflows/release.yml`
- 修改：`package.json`

- [ ] **步骤 1：编写失败的版本同步测试**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { bumpMetadata } from "../scripts/version-bump.mjs";
test("syncs manifest and versions", () => {
  const result = bumpMetadata({ version: "0.1.0", minAppVersion: "1.12.7" }, { "0.1.0": "1.12.7" }, "1.0.0");
  assert.equal(result.manifest.version, "1.0.0");
  assert.equal(result.versions["1.0.0"], "1.12.7");
});
```

- [ ] **步骤 2：运行测试，确认 FAIL `ERR_MODULE_NOT_FOUND`。**

- [ ] **步骤 3：实现 `scripts/version-bump.mjs`**

```js
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export function bumpMetadata(manifest, versions, targetVersion) {
  const nextManifest = { ...manifest, version: targetVersion };
  return { manifest: nextManifest, versions: { ...versions, [targetVersion]: nextManifest.minAppVersion } };
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
  const versions = JSON.parse(await readFile("versions.json", "utf8"));
  const next = bumpMetadata(manifest, versions, pkg.version);
  await writeFile("manifest.json", `${JSON.stringify(next.manifest, null, 2)}\n`);
  await writeFile("versions.json", `${JSON.stringify(next.versions, null, 2)}\n`);
}
```

在 `package.json` 增加 `"version:sync": "node scripts/version-bump.mjs"`。

- [ ] **步骤 4：创建 README**

```markdown
# Aera

A quiet interface for clear thinking.

Aera is an Obsidian theme for calm, readable Chinese-first notes with light, dark, desktop, and mobile support.

![Aera screenshot](screenshot.png)

## Development

Run `npm install`, `npm run build`, and `npm run check`.

For live preview, set `AERA_TEST_VAULT`, then run `npm run link:vault` and `npm run dev`.

## Release assets

Every release contains `manifest.json` and `theme.css`.

## License

[MIT](LICENSE)
```

- [ ] **步骤 5：创建 GitHub Actions**

`.github/workflows/checks.yml`：

```yaml
name: Checks
on: [push, pull_request]
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: git diff --exit-code -- theme.css
```

`.github/workflows/release.yml`：

```yaml
name: Release Obsidian theme
on:
  push:
    tags: ["*"]
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run check
      - run: node scripts/check-theme.mjs --release-tag "$GITHUB_REF_NAME"
      - run: git diff --exit-code -- theme.css
      - name: Create draft release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release create "$GITHUB_REF_NAME" --title "$GITHUB_REF_NAME" --generate-notes --draft manifest.json theme.css
```

- [ ] **步骤 6：验证并提交**

```bash
node --test tests/version-bump.test.mjs
npm run check
git diff --exit-code -- theme.css
git add README.md scripts/version-bump.mjs tests/version-bump.test.mjs package.json package-lock.json .github/workflows
git commit -m "ci: add checks and release automation"
```

## 任务 9：在真实 Obsidian 中完成视觉 QA

**文件：**
- 创建：`screenshot.png`
- 修改：`.gitignore`，加入 `artifacts/`
- 仅在缺陷测试要求时创建：`src/platforms/_mobile.scss`
- 仅在 QA 失败时修改：对应 SCSS、测试和 `theme.css`

- [ ] **步骤 1：验证专用 Vault 并建立链接**

```bash
: "${AERA_TEST_VAULT:?Set AERA_TEST_VAULT to a dedicated Obsidian vault path}"
export AERA_TEST_VAULT_NAME="$(basename "$AERA_TEST_VAULT")"
npm run link:vault
open -a Obsidian "$AERA_TEST_VAULT"
obsidian vaults verbose | rg -F "$AERA_TEST_VAULT"
```

预期：Vault 列表包含该路径，`.obsidian/themes/Aera` 指向当前仓库。

- [ ] **步骤 2：启用 Aera 并打开 Playground**

```bash
obsidian vault="$AERA_TEST_VAULT_NAME" command id=theme:switch
obsidian vault="$AERA_TEST_VAULT_NAME" open path="Theme Playground.md"
```

预期：主题选择器弹出；选择 `Aera` 后打开测试笔记。首次加载 Manifest 时重启 Obsidian。

- [ ] **步骤 3：清空错误并检查变量来源**

```bash
obsidian vault="$AERA_TEST_VAULT_NAME" dev:errors clear
obsidian vault="$AERA_TEST_VAULT_NAME" dev:console clear
obsidian vault="$AERA_TEST_VAULT_NAME" dev:css selector="body" prop="--line-height-normal"
obsidian vault="$AERA_TEST_VAULT_NAME" dev:css selector="body" prop="--file-line-width"
obsidian vault="$AERA_TEST_VAULT_NAME" dev:css selector="body" prop="--font-text-size"
```

预期：行高值为 `1.8` 且来源是 `theme.css`；行宽和字号不由 `theme.css` 覆盖。

- [ ] **步骤 4：验证用户设置和三种正文视图**

先执行并观察可读行长开关：

```bash
obsidian vault="$AERA_TEST_VAULT_NAME" command id=editor:toggle-readable-line-length
obsidian vault="$AERA_TEST_VAULT_NAME" dev:css selector="body" prop="--file-line-width"
obsidian vault="$AERA_TEST_VAULT_NAME" command id=editor:toggle-readable-line-length
```

然后在 **Settings → Appearance** 中把正文字号改为 `20`、强调色改为蓝色、正文字体选择另一种已安装字体。每次都用 `dev:css` 检查正文、链接和代码的计算值，确认主题未覆盖设置；完成后恢复默认值。

依次验证 Live Preview、Source Mode 和 Reading View：

```bash
mkdir -p artifacts
obsidian vault="$AERA_TEST_VAULT_NAME" command id=editor:toggle-source
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-source.png"
obsidian vault="$AERA_TEST_VAULT_NAME" command id=editor:toggle-source
obsidian vault="$AERA_TEST_VAULT_NAME" command id=markdown:toggle-preview
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-reading.png"
obsidian vault="$AERA_TEST_VAULT_NAME" command id=markdown:toggle-preview
```

预期：三种视图均可用，用户设置优先，Source Mode 的 Markdown 标记未被隐藏或重排。

- [ ] **步骤 5：截取浅色、深色和移动端画面**

```bash
mkdir -p artifacts
body_class=$(obsidian vault="$AERA_TEST_VAULT_NAME" dev:dom selector="body" attr=class)
if [[ "$body_class" != *theme-light* ]]; then
  obsidian vault="$AERA_TEST_VAULT_NAME" command id=theme:toggle-light-dark
fi
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-light.png"
obsidian vault="$AERA_TEST_VAULT_NAME" command id=theme:toggle-light-dark
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-dark.png"
obsidian vault="$AERA_TEST_VAULT_NAME" dev:mobile on
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-mobile.png"
obsidian vault="$AERA_TEST_VAULT_NAME" dev:mobile off
```

预期：三张图片均非空，并分别显示浅色、深色和移动端布局。

- [ ] **步骤 6：用 `view_image` 逐张检查并读取运行错误**

检查正文、链接、H1-H6、列表、引用、代码、Callout、表格、标签、Properties、嵌入和脚注；确认窄分栏与移动端无横向页面溢出、遮挡或重叠。然后运行：

```bash
obsidian vault="$AERA_TEST_VAULT_NAME" dev:errors
obsidian vault="$AERA_TEST_VAULT_NAME" dev:console level=error
```

预期：没有 Aera CSS 引发的错误。

- [ ] **步骤 7：对视觉缺陷执行红绿回归循环**

每个缺陷必须：在对应 `tests/*.test.mjs` 添加失败断言；确认 FAIL；只修改负责该元素的 SCSS；运行目标测试与 `npm run check`；重新截图确认。移动端专属缺陷才创建 `_mobile.scss`。

- [ ] **步骤 8：生成社区截图并验证尺寸**

```bash
magick artifacts/aera-light.png -resize '512x288^' -gravity center -extent 512x288 -strip screenshot.png
magick identify -format '%wx%h\n' screenshot.png
```

预期：输出 `512x288`。

- [ ] **步骤 9：忽略本地截图并提交 QA 结果**

使用 `apply_patch` 在 `.gitignore` 末尾添加：

```gitignore
artifacts/
```

```bash
git add .gitignore screenshot.png src theme.css tests
git commit -m "test: verify Aera in Obsidian"
```

## 任务 10：准备 1.0.0 发布候选

**文件：**
- 修改：`package.json`、`package-lock.json`、`manifest.json`、`versions.json`
- 修改：`theme.css`，仅当最终构建产生变化

- [ ] **步骤 1：更新版本但不创建 tag**

```bash
npm version 1.0.0 --no-git-tag-version
npm run version:sync
```

预期：package、lockfile 与 Manifest 均为 `1.0.0`；`versions.json` 包含 `"1.0.0": "1.12.7"`。

- [ ] **步骤 2：运行发布候选验证**

```bash
npm run check
node scripts/check-theme.mjs --release-tag 1.0.0
git diff --check
git diff --exit-code -- theme.css
magick identify -format '%wx%h\n' screenshot.png
test -s manifest.json
test -s theme.css
test -s README.md
test -s LICENSE
test -s screenshot.png
```

预期：全部命令退出 0，截图输出 `512x288`。

- [ ] **步骤 3：提交发布候选**

```bash
git add package.json package-lock.json manifest.json versions.json theme.css
git commit -m "chore: prepare Aera 1.0.0"
```

- [ ] **步骤 4：保持外部发布审批门**

计划到本地 `1.0.0` 发布候选提交为止。不要自动 push、创建 tag、GitHub Release 或提交 Community Themes；这些外部写操作必须在 Peter 审查真实 Obsidian 截图和发布候选后单独确认。
