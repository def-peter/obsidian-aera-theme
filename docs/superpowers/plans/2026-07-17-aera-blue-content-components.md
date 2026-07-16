# Aera 蓝色基调与正文组件实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 Aera 的默认绿色基调迁移到以 `#1677FF` 为核心的冷中性蓝色体系，并实现语义 Callout、折角引用、Monokai 多行代码块和更清晰的行内代码。

**架构：** 继续使用模块化 SCSS 和单一根 `theme.css`。官方变量承担颜色与排版；只有 Callout 图标定位、折角和块级 Monokai 无法由变量表达时才使用经主题政策登记的低特异性选择器。所有行为先写失败测试，再做最小实现，并在专用 Vault 中用 Obsidian CLI 验证真实 DOM。

**技术栈：** Dart Sass、PostCSS、Node.js 24 内置测试、Obsidian 1.12.7 CLI、ImageMagick。

---

## 执行纪律

- 在现有 `feature/aera-v1` 分支执行，不创建 tag，不 push，不发布。
- 每个任务只允许一个实现代理；实现后依次做规格审查和质量审查。
- 发现问题时由原实现代理按 TDD 修复，再由原审查代理复审。
- 不设置 `--font-text-size`、`--file-line-width` 或 `--font-interface-theme`。
- 不使用 `!important`、`:has()`、远程 URL、运行时 `@import`、JavaScript 或图片装饰。
- 每次 `npm run build` 后必须确认 `theme.css` 是唯一生成产物。

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src/foundations/_colors.scss` | 冷中性浅深色灰阶、默认蓝色 accent、组件颜色令牌 |
| `src/editor/_code.scss` | 行内代码变量和块级 Monokai 作用域 |
| `src/components/_callouts.scss` | Callout 变量、语义表面、原生图标重排 |
| `src/editor/_quotes.scss` | Reading、Live Preview、Source Mode 引用结构 |
| `tests/foundations.test.mjs` | 颜色令牌、用户设置边界和对比度断言 |
| `scripts/contrast.mjs` | 默认颜色、行内代码和 Monokai 关键文本对比度检查 |
| `tests/editor-blocks.test.mjs` | 代码块与引用变量、选择器和声明断言 |
| `tests/components.test.mjs` | Callout 和全局允许选择器集合 |
| `tests/helpers/css.mjs` | 主题选择器与 Callout 变量政策 |
| `fixtures/Theme Playground.md` | 真实 Obsidian 视觉 QA 内容 |
| `tests/link-vault.test.mjs` | fixture 语义覆盖与安全复制回归 |
| `theme.css` | Sass 编译产物 |
| `screenshot.png` | 512×288 社区主题预览 |

## 已确认的 Obsidian 1.12.7 DOM

- Live Preview 容器：`.markdown-source-view.mod-cm6.is-live-preview`。
- Source Mode 容器：`.markdown-source-view.mod-cm6:not(.is-live-preview)`。
- 一级引用行：`.HyperMD-quote.HyperMD-quote-1.cm-line`。
- fenced code 行：`.HyperMD-codeblock`，首尾分别带 `.HyperMD-codeblock-begin` 和 `.HyperMD-codeblock-end`。
- Reading code：`.markdown-rendered pre:not(.frontmatter)`；必须排除隐藏的 YAML frontmatter `pre`。
- Callout 结构：`.callout > .callout-title > .callout-icon`，内容为 `.callout-content`，折叠箭头为 `.callout-fold`。

### 任务 1：蓝色与冷中性色基础

**文件：**
- 修改：`tests/foundations.test.mjs`
- 修改：`scripts/contrast.mjs`
- 修改：`src/foundations/_colors.scss`
- 生成：`theme.css`

- [ ] **步骤 1：把颜色基础测试改为新令牌**

在 `tests/foundations.test.mjs` 中将 `expectedColors` 替换为以下值；保留已有的用户字号、字体和行宽边界测试：

```js
const expectedColors = {
  ".theme-light": {
    "--color-base-00": "#f8fafc",
    "--color-base-05": "#f5f7fa",
    "--color-base-10": "#f1f4f8",
    "--color-base-20": "#e9eef5",
    "--color-base-25": "#dde3eb",
    "--color-base-30": "#cdd5df",
    "--color-base-35": "#bec8d4",
    "--color-base-40": "#a9b4c2",
    "--color-base-50": "#8793a3",
    "--color-base-60": "#647184",
    "--color-base-70": "#475467",
    "--color-base-100": "#202936",
    "--background-primary": "var(--color-base-00)",
    "--background-secondary": "var(--color-base-10)",
    "--text-normal": "var(--color-base-100)",
    "--text-muted": "var(--color-base-60)",
    "--text-faint": "var(--color-base-50)",
    "--text-highlight-bg": "rgba(245, 198, 50, 0.22)",
    "--accent-h": "215",
    "--accent-s": "100%",
    "--accent-l": "54.3%",
    "--interactive-accent": "hsl(var(--accent-h), var(--accent-s), var(--accent-l))",
    "--text-accent": "hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) - 10%))",
    "--text-accent-hover": "hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) - 14%))",
    "--aera-inline-code-background": "#d9dee5",
    "--aera-inline-code-color": "#566273",
    "--aera-callout-background-opacity": "0.08",
    "--aera-quote-background": "#f1f3f6",
    "--aera-quote-fold": "#d9dee5",
  },
  ".theme-dark": {
    "--color-base-00": "#17191c",
    "--color-base-05": "#1b1e22",
    "--color-base-10": "#20242a",
    "--color-base-20": "#282d34",
    "--color-base-25": "#30363e",
    "--color-base-30": "#39414b",
    "--color-base-35": "#46505c",
    "--color-base-40": "#596575",
    "--color-base-50": "#748092",
    "--color-base-60": "#9aa5b4",
    "--color-base-70": "#c1c7d0",
    "--color-base-100": "#e7ebf0",
    "--background-primary": "var(--color-base-00)",
    "--background-secondary": "var(--color-base-10)",
    "--text-normal": "var(--color-base-100)",
    "--text-muted": "var(--color-base-60)",
    "--text-faint": "var(--color-base-50)",
    "--text-highlight-bg": "rgba(245, 198, 50, 0.26)",
    "--accent-h": "213",
    "--accent-s": "100%",
    "--accent-l": "62.5%",
    "--interactive-accent": "hsl(var(--accent-h), var(--accent-s), var(--accent-l))",
    "--text-accent": "hsl(var(--accent-h), var(--accent-s), var(--accent-l))",
    "--text-accent-hover": "hsl(var(--accent-h), var(--accent-s), calc(var(--accent-l) + 5%))",
    "--aera-inline-code-background": "#2a2f36",
    "--aera-inline-code-color": "#b8c0cc",
    "--aera-callout-background-opacity": "0.12",
    "--aera-quote-background": "#22262c",
    "--aera-quote-fold": "#3a414a",
  },
};
```

- [ ] **步骤 2：扩展对比度测试**

在 `tests/foundations.test.mjs` 中把核心对比度断言改为 11 组：

```js
assert.deepEqual(CORE_CONTRAST_PAIRS, [
  ["light text", "#202936", "#f8fafc"],
  ["light muted", "#647184", "#f8fafc"],
  ["light text accent", "#005ee2", "#f8fafc"],
  ["dark text", "#e7ebf0", "#17191c"],
  ["dark muted", "#9aa5b4", "#17191c"],
  ["dark text accent", "#4096ff", "#17191c"],
  ["light inline code", "#566273", "#d9dee5"],
  ["dark inline code", "#b8c0cc", "#2a2f36"],
  ["monokai normal", "#f8f8f2", "#272822"],
  ["monokai comment", "#929388", "#272822"],
  ["monokai keyword", "#ff4b8b", "#272822"],
]);

const expectedRatios = [
  "14.02", "4.74", "5.43", "14.71", "7.06", "5.89",
  "4.58", "7.35", "13.94", "4.78", "4.69",
];
```

将 CLI 测试的名称和行数断言同步为 11 组。

- [ ] **步骤 3：运行测试确认红灯**

运行：

```bash
node --test tests/foundations.test.mjs
```

预期：FAIL。失败必须来自旧绿色令牌和旧 6 组对比度数组，而不是语法错误。

- [ ] **步骤 4：实现新的颜色基础**

在 `scripts/contrast.mjs` 中用步骤 2 的 11 组值替换 `CORE_CONTRAST_PAIRS`。

在 `src/foundations/_colors.scss` 中按步骤 1 的完整值替换 `.theme-light` 和 `.theme-dark`。颜色声明必须继续保留在两个主题作用域内，不移动到 `body`。

- [ ] **步骤 5：构建并验证绿灯**

```bash
npm run build
node --test tests/foundations.test.mjs
node scripts/contrast.mjs
npm run check
git diff --check
```

预期：所有测试通过；对比度 CLI 输出 11 行 `PASS`；`theme.css` 只包含颜色更新。

- [ ] **步骤 6：提交颜色基础**

```bash
git add src/foundations/_colors.scss scripts/contrast.mjs tests/foundations.test.mjs theme.css
git commit -m "feat: shift Aera to a blue color system"
```

### 任务 2：行内代码与 Monokai 多行代码块

**文件：**
- 修改：`tests/helpers/css.mjs`
- 修改：`tests/components.test.mjs`
- 修改：`tests/editor-blocks.test.mjs`
- 修改：`src/editor/_code.scss`
- 生成：`theme.css`

- [ ] **步骤 1：登记代码块选择器**

在 `tests/helpers/css.mjs` 的 `allowedThemeSelectors` 和 `tests/components.test.mjs` 的 `allowedSelectors` 中移除旧 `.markdown-rendered pre`，并添加：

```js
":where(.markdown-rendered pre:not(.frontmatter))",
":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock)",
":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock-begin)",
":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock-end)",
```

两个集合必须完全相同，不允许通配 `.markdown-source-view`。

- [ ] **步骤 2：编写失败的代码样式测试**

在 `tests/editor-blocks.test.mjs` 中将 body 代码变量断言改为行内代码，并为 Reading/Editor 两个块作用域添加相同的 Monokai 断言：

```js
test("keeps inline code in the reading color system", () => {
  assertDeclarations({
    "--code-background": "var(--aera-inline-code-background)",
    "--code-normal": "var(--aera-inline-code-color)",
    "--code-white-space": "pre",
    "--code-size": "0.88em",
  });
});

const monokai = {
  "--code-background": "#272822",
  "--code-normal": "#f8f8f2",
  "--code-comment": "#929388",
  "--code-function": "#a6e22e",
  "--code-important": "#fd971f",
  "--code-keyword": "#ff4b8b",
  "--code-operator": "#f8f8f2",
  "--code-property": "#66d9ef",
  "--code-punctuation": "#f8f8f2",
  "--code-string": "#e6db74",
  "--code-tag": "#ff4b8b",
  "--code-value": "#ae81ff",
};

for (const selector of [
  ":where(.markdown-rendered pre:not(.frontmatter))",
  ":where(.markdown-source-view.mod-cm6 .HyperMD-codeblock)",
]) {
  test(`${selector} defines scoped Monokai colors`, () => {
    const declarations = declarationsFor(css, selector);
    for (const [property, value] of Object.entries(monokai)) {
      assert.equal(declarations.get(property), value, `${selector} ${property}`);
    }
    assert.equal(declarations.get("background-color"), "#272822");
    assert.equal(declarations.get("color"), "#f8f8f2");
  });
}
```

再断言 begin/end 的圆角：首行 `6px 6px 0 0`，末行 `0 0 6px 6px`。

- [ ] **步骤 3：运行测试确认红灯**

```bash
node --test tests/editor-blocks.test.mjs tests/components.test.mjs
```

预期：FAIL。旧 CSS 缺少新选择器，body 仍使用正文背景，Monokai 声明不存在。

- [ ] **步骤 4：实现块级 Monokai**

将 `src/editor/_code.scss` 改为：

```scss
@mixin monokai-block {
  --code-background: #272822;
  --code-normal: #f8f8f2;
  --code-comment: #929388;
  --code-function: #a6e22e;
  --code-important: #fd971f;
  --code-keyword: #ff4b8b;
  --code-operator: #f8f8f2;
  --code-property: #66d9ef;
  --code-punctuation: #f8f8f2;
  --code-string: #e6db74;
  --code-tag: #ff4b8b;
  --code-value: #ae81ff;
  background-color: #272822;
  color: #f8f8f2;
  border: 1px solid #3e3d32;
}

body {
  --code-background: var(--aera-inline-code-background);
  --code-white-space: pre;
  --code-size: 0.88em;
  --code-normal: var(--aera-inline-code-color);
}

:where(.markdown-rendered pre:not(.frontmatter)) {
  @include monokai-block;
  border-radius: 6px;
}

:where(.markdown-source-view.mod-cm6 .HyperMD-codeblock) {
  @include monokai-block;
  border-block-width: 0;
  border-radius: 0;
}

:where(.markdown-source-view.mod-cm6 .HyperMD-codeblock-begin) {
  border-block-start-width: 1px;
  border-radius: 6px 6px 0 0;
}

:where(.markdown-source-view.mod-cm6 .HyperMD-codeblock-end) {
  border-block-end-width: 1px;
  border-radius: 0 0 6px 6px;
}
```

如果 Sass 输出重复边框声明，只允许在绿灯后的重构步骤压缩；不能先改变行为。

- [ ] **步骤 5：构建并验证绿灯**

```bash
npm run build
node --test tests/editor-blocks.test.mjs tests/components.test.mjs
npm run check
git diff --check
```

预期：全部通过；`theme.css` 不再包含旧 `.markdown-rendered pre` 规则。

- [ ] **步骤 6：提交代码样式**

```bash
git add src/editor/_code.scss tests/editor-blocks.test.mjs tests/components.test.mjs tests/helpers/css.mjs theme.css
git commit -m "feat: add scoped Monokai code blocks"
```

### 任务 3：无边框语义 Callout 与右侧图标

**文件：**
- 修改：`tests/helpers/css.mjs`
- 修改：`tests/components.test.mjs`
- 修改：`src/components/_callouts.scss`
- 生成：`theme.css`

- [ ] **步骤 1：登记精确 Callout 选择器**

在两个允许选择器集合中添加以下完整字符串：

```js
":where(.callout)",
":where(.callout-title)",
":where(.callout-content)",
":where(.callout-icon)",
":where(.callout-icon svg)",
":where(.callout-fold)",
":where(.callout.is-collapsed .callout-icon)",
```

- [ ] **步骤 2：编写失败的 Callout 测试**

将 body Callout 变量期望改为：

```js
{
  "--callout-padding": "var(--size-4-3) var(--size-4-4)",
  "--callout-title-padding": "0",
  "--callout-content-padding": "var(--size-4-2) 0 0",
  "--callout-border-width": "0px",
  "--callout-border-opacity": "0",
  "--callout-radius": "7px",
  "--callout-blend-mode": "normal",
  "--callout-title-size": "var(--font-small)",
  "--callout-title-weight": "600",
  "--callout-content-background": "transparent",
}
```

添加直接声明断言：

```js
test("positions the native callout icon as a quiet watermark", () => {
  const callout = declarationsFor(css, ":where(.callout)");
  assert.equal(callout.get("position"), "relative");
  assert.equal(callout.get("overflow"), "hidden");
  assert.equal(
    callout.get("background-color"),
    "rgba(var(--callout-color), var(--aera-callout-background-opacity))",
  );
  assert.equal(callout.get("border"), "0");

  const icon = declarationsFor(css, ":where(.callout-icon)");
  assert.equal(icon.get("position"), "absolute");
  assert.equal(icon.get("pointer-events"), "none");
  assert.equal(icon.get("opacity"), "0.09");

  const svg = declarationsFor(css, ":where(.callout-icon svg)");
  assert.equal(svg.get("width"), "48px");
  assert.equal(svg.get("height"), "48px");

  assert.equal(
    declarationsFor(css, ":where(.callout.is-collapsed .callout-icon)").get(
      "display",
    ),
    "none",
  );
});
```

继续断言所有官方 `--callout-*` 类型变量都不存在。

- [ ] **步骤 3：运行测试确认红灯**

```bash
node --test tests/components.test.mjs
```

预期：FAIL。旧边框仍为 `1px`，新结构选择器不存在。

- [ ] **步骤 4：实现 Callout 结构**

将 `src/components/_callouts.scss` 改为：

```scss
body {
  --callout-border-width: 0px;
  --callout-border-opacity: 0;
  --callout-radius: 7px;
  --callout-blend-mode: normal;
  --callout-title-size: var(--font-small);
  --callout-title-weight: 600;
  --callout-content-background: transparent;
}

:where(.callout) {
  position: relative;
  overflow: hidden;
  background-color: rgba(
    var(--callout-color),
    var(--aera-callout-background-opacity)
  );
  color: color-mix(
    in srgb,
    rgb(var(--callout-color)) 72%,
    var(--text-normal)
  );
  border: 0;
}

:where(.callout-title) {
  position: relative;
  z-index: 1;
  padding-inline-end: var(--size-4-12);
  color: color-mix(
    in srgb,
    rgb(var(--callout-color)) 84%,
    var(--text-normal)
  );
}

:where(.callout-content) {
  position: relative;
  z-index: 1;
  padding-inline-end: var(--size-4-12);
}

:where(.callout-icon) {
  position: absolute;
  inset-inline-end: var(--size-4-2);
  inset-block-end: calc(var(--size-4-2) * -1);
  opacity: 0.09;
  pointer-events: none;
}

:where(.callout-icon svg) {
  width: 48px;
  height: 48px;
}

:where(.callout-fold) {
  position: relative;
  z-index: 2;
}

:where(.callout.is-collapsed .callout-icon) {
  display: none;
}
```

不要定义任何 Callout 类型颜色。若 `color-mix()` 的序列化空格与 PostCSS 实际输出不同，只调整测试的精确字符串，不改变比例。

- [ ] **步骤 5：构建并验证绿灯**

```bash
npm run build
node --test tests/components.test.mjs
npm run check
git diff --check
```

预期：全部通过；主题政策继续拒绝作用域外 `--callout-color`。

- [ ] **步骤 6：提交 Callout**

```bash
git add src/components/_callouts.scss tests/components.test.mjs tests/helpers/css.mjs theme.css
git commit -m "feat: restyle semantic callouts"
```

### 任务 4：三视图折角引用

**文件：**
- 修改：`tests/helpers/css.mjs`
- 修改：`tests/components.test.mjs`
- 修改：`tests/editor-blocks.test.mjs`
- 修改：`src/editor/_quotes.scss`
- 生成：`theme.css`

- [ ] **步骤 1：登记引用选择器**

在两个允许选择器集合中添加：

```js
":where(.markdown-rendered blockquote)",
":where(.markdown-rendered blockquote)::before",
":where(.markdown-rendered blockquote)::after",
":where(.markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote)",
":where(.markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote))",
":where(.markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote))::before",
":where(.markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote))::after",
":where(.markdown-source-view.mod-cm6:not(.is-live-preview) .HyperMD-quote)",
```

- [ ] **步骤 2：编写失败的引用测试**

把 body 引用变量改为：

```js
{
  "--blockquote-background-color": "var(--aera-quote-background)",
  "--blockquote-border-thickness": "0px",
  "--blockquote-border-color": "transparent",
  "--blockquote-font-style": "normal",
  "--blockquote-color": "var(--text-muted)",
}
```

添加以下行为断言：

```js
test("builds the paper fold only in reading and live preview", () => {
  const reading = declarationsFor(css, ":where(.markdown-rendered blockquote)");
  assert.equal(reading.get("position"), "relative");
  assert.equal(reading.get("background"), "var(--aera-quote-background)");
  assert.equal(reading.get("border-radius"), "6px");

  for (const suffix of ["::before", "::after"]) {
    const fold = declarationsFor(
      css,
      `:where(.markdown-rendered blockquote)${suffix}`,
    );
    assert.equal(fold.get("content"), '""');
    assert.equal(fold.get("position"), "absolute");
  }

  const source = declarationsFor(
    css,
    ":where(.markdown-source-view.mod-cm6:not(.is-live-preview) .HyperMD-quote)",
  );
  assert.equal(source.get("background"), "var(--aera-quote-background)");
  assert.equal(source.has("content"), false);
});
```

再断言 Live Preview 的第一行选择器及两个伪元素存在，且全 CSS 不含 `:has(`。

- [ ] **步骤 3：运行测试确认红灯**

```bash
node --test tests/editor-blocks.test.mjs tests/components.test.mjs
```

预期：FAIL。旧引用仍为透明背景和绿色左边框，新视图规则不存在。

- [ ] **步骤 4：实现 Reading、Live Preview 和 Source Mode 规则**

将 `src/editor/_quotes.scss` 改为以下结构。mixin 只消除重复，不会单独输出 CSS；每个伪元素选择器必须独立生成：

```scss
@mixin quote-fold-base {
  content: "";
  position: absolute;
  inset-block-start: -1px;
  inset-inline-start: -1px;
  width: 16px;
  height: 16px;
}

@mixin quote-fold-cutout {
  @include quote-fold-base;
  background: var(--background-primary);
  clip-path: polygon(0 0, 100% 0, 0 100%);
}

@mixin quote-fold-paper {
  @include quote-fold-base;
  background: var(--aera-quote-fold);
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

body {
  --blockquote-background-color: var(--aera-quote-background);
  --blockquote-border-thickness: 0px;
  --blockquote-border-color: transparent;
  --blockquote-font-style: normal;
  --blockquote-color: var(--text-muted);
  --hr-color: var(--background-modifier-border);
  --hr-thickness: 1px;
}

:where(.markdown-rendered blockquote) {
  position: relative;
  margin-inline: 0;
  padding: var(--size-4-4) var(--size-4-5);
  background: var(--aera-quote-background);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  color: var(--blockquote-color);
}

:where(.markdown-rendered blockquote)::before {
  @include quote-fold-cutout;
}

:where(.markdown-rendered blockquote)::after {
  @include quote-fold-paper;
}

:where(.markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote))::before {
  @include quote-fold-cutout;
}

:where(.markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote))::after {
  @include quote-fold-paper;
}

:where(.markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote) {
  background: var(--aera-quote-background);
  color: var(--blockquote-color);
}

:where(.markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote-1:not(.HyperMD-quote + .HyperMD-quote)) {
  position: relative;
  padding-block-start: var(--size-4-3);
  border-radius: 6px 6px 0 0;
}

:where(.markdown-source-view.mod-cm6:not(.is-live-preview) .HyperMD-quote) {
  background: var(--aera-quote-background);
  color: var(--blockquote-color);
}
```

编译结果必须保持每个登记项与规则一一对应，不允许合并成未登记的逗号选择器。

- [ ] **步骤 5：构建并验证绿灯**

```bash
npm run build
node --test tests/editor-blocks.test.mjs tests/components.test.mjs
node scripts/check-theme.mjs
npm run check
git diff --check
```

预期：全部通过；CSS 不包含 `:has()`；Source Mode 规则没有伪元素。

- [ ] **步骤 6：提交引用样式**

```bash
git add src/editor/_quotes.scss tests/editor-blocks.test.mjs tests/components.test.mjs tests/helpers/css.mjs theme.css
git commit -m "feat: add folded paper blockquotes"
```

### 任务 5：扩展视觉 QA fixture

**文件：**
- 修改：`tests/link-vault.test.mjs`
- 修改：`fixtures/Theme Playground.md`

- [ ] **步骤 1：编写失败的 fixture 覆盖测试**

在 `tests/link-vault.test.mjs` 的 playground 覆盖测试中添加精确断言：

```js
assert.match(playground, /^> 第一行引用，用于检查纸张折角。$/m);
assert.match(playground, /^> 第二行引用，用于检查连续卡片。$/m);
assert.match(playground, /^> > 嵌套引用只保留外层折角。$/m);
for (const type of ["note", "warning", "error", "example", "quote", "tip"]) {
  assert.match(playground, new RegExp(`^> \\[!${type}\\]`, "m"));
}
assert.match(playground, /^> \[!tip\]- 收起的提示$/m);
assert.match(playground, /^```javascript$/m);
assert.match(playground, /^```$/m);
assert.ok(playground.trimEnd().endsWith(fixtureOwnershipMarker));
```

测试文件继续复用当前已声明的 `fixtureOwnershipMarker` 常量，不新增第二个 marker 名称。

- [ ] **步骤 2：运行测试确认红灯**

```bash
node --test tests/link-vault.test.mjs
```

预期：FAIL。旧 fixture 只有单行引用、note/warning 和 CSS 代码块。

- [ ] **步骤 3：扩展 fixture**

在 `fixtures/Theme Playground.md` 中：

1. 用三行普通/嵌套引用替换原单行引用。
2. 保留 note、warning，新增 error、example、quote。
3. 新增 `> [!tip]- 收起的提示`，正文一行。
4. 将现有 CSS 代码块替换为包含注释、关键字、字符串、函数、数字和长行的 JavaScript 代码块。
5. 再添加一个无语言 fenced code block。
6. 保持 `<!-- Aera fixture managed by obsidian-aera-theme. -->` 为最后一行。

JavaScript 示例使用以下内容：

```javascript
// Monokai syntax coverage
const accent = "#1677FF";
function renderTheme(name, retries = 3) {
  return `${name}:${retries}`;
}
renderTheme("Aera");
```

- [ ] **步骤 4：验证 fixture 与安全链接**

```bash
node --test tests/link-vault.test.mjs
AERA_TEST_VAULT=/Users/peter/Code/me/obsidian-plugins/obsidian-aera-theme-test-vault npm run link:vault
cmp fixtures/Theme\ Playground.md /Users/peter/Code/me/obsidian-plugins/obsidian-aera-theme-test-vault/Theme\ Playground.md
npm run check
```

预期：全部通过；linker 只更新带 ownership marker 的专用 fixture。

- [ ] **步骤 5：提交 fixture**

```bash
git add fixtures/Theme\ Playground.md tests/link-vault.test.mjs
git commit -m "test: expand blue component playground"
```

### 任务 6：真实 Obsidian 视觉 QA 与预览图

**文件：**
- 修改：`screenshot.png`
- 仅在缺陷回归要求时修改：对应 `src/**/*.scss`、`tests/*.test.mjs`、`theme.css`
- 本地忽略证据：`artifacts/`

- [ ] **步骤 1：链接并启用最新主题**

```bash
export AERA_TEST_VAULT=/Users/peter/Code/me/obsidian-plugins/obsidian-aera-theme-test-vault
export AERA_TEST_VAULT_NAME=obsidian-aera-theme-test-vault
npm run build
npm run link:vault
obsidian vault="$AERA_TEST_VAULT_NAME" theme:set name=Aera
obsidian vault="$AERA_TEST_VAULT_NAME" open path="Theme Playground.md"
obsidian vault="$AERA_TEST_VAULT_NAME" dev:errors clear
obsidian vault="$AERA_TEST_VAULT_NAME" dev:console clear
```

预期：所有命令退出 0，Aera 启用，Playground 打开。

- [ ] **步骤 2：验证默认颜色和用户设置优先**

使用 `obsidian eval` 读取 body 的计算变量：

```bash
obsidian vault="$AERA_TEST_VAULT_NAME" eval code="(()=>{const s=getComputedStyle(document.body); const keys=['--accent-h','--accent-s','--accent-l','--interactive-accent','--text-accent','--font-text-size','--file-line-width']; return JSON.stringify(Object.fromEntries(keys.map(k=>[k,s.getPropertyValue(k).trim()])))})()"
```

预期：默认 HSL 对应浅色 `#1677FF` 或深色 `#4096FF`；字号和行宽来自 Obsidian 设置。

仅在专用 Vault 中依次临时设置：accent `#7C3AED`、正文 20px、正文 Georgia、等宽字体另一已安装字体。每次用 `getComputedStyle` 检查链接、inline code、代码块和正文，确认设置生效。完成后恢复 `accentColor=""`、`baseFontSize=16`、`textFontFamily=""`、等宽字体默认。

- [ ] **步骤 3：验证 Callout**

检查 note、warning、error、example、quote 和 tip：

```bash
obsidian vault="$AERA_TEST_VAULT_NAME" dev:dom selector='.callout' all
obsidian vault="$AERA_TEST_VAULT_NAME" eval code="JSON.stringify([...document.querySelectorAll('.callout')].map(el=>({type:el.dataset.callout,collapsed:el.classList.contains('is-collapsed'),overflow:el.scrollWidth>el.clientWidth})))"
```

预期：所有类型存在；无边框；正文和标题为语义色；右下原生图标不遮挡；折叠 tip 隐藏大图标；无横向溢出。

- [ ] **步骤 4：验证三视图引用和代码**

按顺序验证 Live Preview、Source Mode、Reading View：

```bash
mkdir -p artifacts
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-blue-live-preview.png"
obsidian vault="$AERA_TEST_VAULT_NAME" command id=editor:toggle-source
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-blue-source.png"
obsidian vault="$AERA_TEST_VAULT_NAME" command id=editor:toggle-source
obsidian vault="$AERA_TEST_VAULT_NAME" command id=markdown:toggle-preview
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-blue-reading.png"
```

预期：

- Live Preview 的连续引用只有一个左上折角。
- Source Mode 的 `>` 与 fenced markers 可见，引用无折角。
- Reading View 的 blockquote 有折角，代码块排除隐藏 frontmatter。
- 三个视图的多行代码块均为 Monokai；行内代码保持中性灰。

- [ ] **步骤 5：检查浅色、深色、窄分栏和移动端**

```bash
obsidian vault="$AERA_TEST_VAULT_NAME" command id=markdown:toggle-preview
body_class=$(obsidian vault="$AERA_TEST_VAULT_NAME" dev:dom selector="body" attr=class)
if [[ "$body_class" != *theme-light* ]]; then
  obsidian vault="$AERA_TEST_VAULT_NAME" command id=theme:toggle-light-dark
fi
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-blue-light.png"
obsidian vault="$AERA_TEST_VAULT_NAME" command id=theme:toggle-light-dark
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-blue-dark.png"
obsidian vault="$AERA_TEST_VAULT_NAME" dev:mobile on
obsidian vault="$AERA_TEST_VAULT_NAME" dev:screenshot path="$PWD/artifacts/aera-blue-mobile.png"
obsidian vault="$AERA_TEST_VAULT_NAME" dev:mobile off
```

用 `view_image` 原尺寸检查六张图。正文根节点不得横向溢出；代码长行必须只在代码容器内滚动。

- [ ] **步骤 6：对每个视觉缺陷执行 TDD**

如果发现缺陷：

1. 在负责组件的现有测试文件添加一个最小失败断言。
2. 运行目标测试，确认因该缺陷红灯。
3. 只修改负责该组件的 SCSS。
4. `npm run build` 后运行目标测试和 `npm run check`。
5. 重复对应截图并用 `view_image` 复核。

禁止直接试 CSS 后补测试。

- [ ] **步骤 7：生成社区预览**

从构图最佳的浅色截图生成：

```bash
magick artifacts/aera-blue-light.png \
  -crop '1024x576+0+80' +repage \
  -resize 512x288 \
  -colorspace sRGB -strip \
  +set date:create +set date:modify +set date:timestamp \
  -define png:exclude-chunk=time,text \
  screenshot.png
magick identify -format '%wx%h %z-bit %[colorspace] %b\n' screenshot.png
```

预期：`512x288 8-bit sRGB`。如果窗口尺寸不是 1024×800，不照搬 crop；先用 `identify` 计算不切断工具栏或标题的 16:9 区域，再生成。

- [ ] **步骤 8：读取错误并提交 QA**

```bash
obsidian vault="$AERA_TEST_VAULT_NAME" dev:errors
obsidian vault="$AERA_TEST_VAULT_NAME" dev:console level=error limit=100
npm run check
git diff --check
git add screenshot.png src tests theme.css fixtures
git commit -m "test: verify blue content components in Obsidian"
```

预期：Obsidian 无错误；只提交实际变化文件；`artifacts/` 保持忽略。

### 任务 7：最终 1.0.0 RC 验证

**文件：**
- 验证：`package.json`、`package-lock.json`、`manifest.json`、`versions.json`
- 验证：`theme.css`、`screenshot.png`、README、LICENSE

- [ ] **步骤 1：验证版本未漂移**

```bash
node --input-type=module --eval "
import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync('package.json'));
const lock=JSON.parse(fs.readFileSync('package-lock.json'));
const manifest=JSON.parse(fs.readFileSync('manifest.json'));
const versions=JSON.parse(fs.readFileSync('versions.json'));
if (![pkg.version,lock.version,lock.packages[''].version,manifest.version].every(v=>v==='1.0.0')) process.exit(1);
if (versions['1.0.0']!=='1.12.7') process.exit(1);
console.log('Aera 1.0.0 metadata aligned');
"
```

预期：输出 `Aera 1.0.0 metadata aligned`。

- [ ] **步骤 2：运行完整发布候选门禁**

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
git status --short --branch
git tag --list
```

预期：自动化测试全部通过；截图为 `512x288`；工作区干净；没有本地 tag。

- [ ] **步骤 3：最终独立审查**

独立审查 `82497d7..HEAD`：

- 规格覆盖和选择器边界。
- 用户 accent、字体、字号、行宽优先级。
- Callout 语义色与折叠行为。
- 引用三视图差异。
- 行内代码与 Monokai 作用域隔离。
- fixture/linker 安全。
- 截图和版本资产。

Critical 与 Important 必须由原实现代理修复并重新审查；没有未解决问题后才进入分支收尾。

- [ ] **步骤 4：保持外部发布审批门**

不要 push、创建 Pull Request、tag、GitHub Release 或提交 Community Themes。使用 `finishing-a-development-branch` 给 Peter 提供本地合并、PR、保持分支或丢弃选项。
