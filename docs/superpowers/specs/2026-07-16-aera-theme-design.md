# Aera Obsidian 主题设计规格

日期：2026-07-16

状态：已完成设计确认

作者：Peter

## 1. 项目概述

Aera 是一款面向 Obsidian 的社区主题，名称固定为 `Aera`，品牌描述为：

> A quiet interface for clear thinking.

首版目标是先把正文体验做好，为中文为主、少量英文混排的笔记提供安静、清晰、长期阅读舒适的视觉环境。Aera 参考 Asri 的低干扰界面、感知亮度配色和细腻排版原则，但不移植思源笔记的 DOM、脚本、动态取色、玻璃材质或复杂交互。

主题同时支持桌面端和移动端，并包含浅色与深色模式。

## 2. 官方约束

设计与实现遵循以下官方文档：

- [Build a theme](https://docs.obsidian.md/Themes/App+themes/Build+a+theme)
- [Embed fonts and images in your theme](https://docs.obsidian.md/Themes/App+themes/Embed+fonts+and+images+in+your+theme)
- [Release your theme with GitHub Actions](https://docs.obsidian.md/Themes/App+themes/Release+your+theme+with+GitHub+Actions)
- [Submit your theme](https://docs.obsidian.md/Themes/App+themes/Submit+your+theme)
- [Theme guidelines](https://docs.obsidian.md/Themes/App+themes/Theme+guidelines)
- [Manifest](https://docs.obsidian.md/Reference/Manifest)
- [CSS variables](https://docs.obsidian.md/Reference/CSS+variables/CSS+variables)
- [Typography variables](https://docs.obsidian.md/Reference/CSS+variables/Foundations/Typography)
- [Editor file variables](https://docs.obsidian.md/Reference/CSS+variables/Editor/File)

实现规则：

1. 优先覆盖 Obsidian 官方 CSS 变量。
2. 仅在官方变量无法表达且问题影响正文可用性时使用低权重选择器。
3. 不使用 `!important`。
4. 不使用 `:has()`，除非后续出现无法替代且经过性能验证的明确需求；首版不包含该选择器。
5. 不加载远程字体、图片或其他网络资源。
6. 不加入 JavaScript、DOM 观察或动态取色。
7. 不覆盖由用户控制的字号、可读行长、字体选择和强调色。
8. 间距优先采用 Obsidian 的 `--size-*` 4px 网格变量。

## 3. 首版范围

首版覆盖完整正文元素：

- 普通段落
- H1 至 H6 标题
- 文内标题
- 粗体、斜体和高亮
- 已解析内部链接、未解析内部链接和外部链接
- 引用
- 有序列表、无序列表和嵌套列表
- 任务列表与复选框
- 行内代码、代码块和语法高亮
- 分隔线
- Callout 及其语义类型
- 表格
- 标签
- Properties 属性区
- 文件嵌入
- 脚注

首版不包含：

- Bases 和 Canvas 专项视觉
- 社区插件专项适配
- 窗口透明、玻璃材质和 macOS 红绿灯调整
- 题头图、视差滚动和全宽媒体扩展
- Style Settings 插件集成
- 自定义或内嵌字体
- 动画系统

## 4. 用户设置边界

以下值由 Obsidian 或用户控制，Aera 不覆盖：

| 变量或能力 | 处理方式 |
| --- | --- |
| `--font-text-size` | 由用户在外观设置中控制 |
| `--file-line-width` | 由“可读行长”开关控制 |
| 用户正文与等宽字体 | 用户选择优先于主题默认字体 |
| 用户强调色 | 用户选择优先于 Aera 默认墨绿 |
| CSS Snippets | 主题不使用 `!important` 阻止覆盖 |

Aera 不设置强制 `max-width`，并验证可读行长开启与关闭两种状态。

## 5. 视觉方向

### 5.1 排版气质

视觉方向为“现代人文”：柔和的无衬线字体、克制字重、宽松但不过度稀疏的中文行高，以及明显但安静的正文层级。

默认正文字体栈：

```css
--font-text-theme:
  "Avenir Next",
  Avenir,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "PingFang SC",
  "Microsoft YaHei",
  "Noto Sans CJK SC",
  sans-serif;
```

默认等宽字体栈：

```css
--font-monospace-theme:
  ui-monospace,
  "SFMono-Regular",
  Consolas,
  "Liberation Mono",
  monospace;
```

Aera 不设置 `--font-interface-theme`，首版不改变 Obsidian 界面字体。

排版基础值：

| 官方变量 | 值 | 目的 |
| --- | --- | --- |
| `--line-height-normal` | `1.8` | 改善中文正文行间呼吸 |
| `--p-spacing` | `var(--size-4-3)` | 12px 段落间距 |
| `--heading-spacing` | `var(--size-4-8)` | 32px 标题上方间距 |
| `--bold-modifier` | `200` | 在不同标题权重上保持合理增量 |

### 5.2 色彩方向

配色方向为“雾白与墨绿”。基础色阶保持低色度中性灰，墨绿仅作为默认强调色；高亮和状态色引入暖黄、红、蓝等语义颜色，避免整个界面成为单一绿色调。

浅色基础色阶：

| Token | 值 |
| --- | --- |
| `--color-base-00` | `#f7f8f6` |
| `--color-base-05` | `#f4f5f3` |
| `--color-base-10` | `#eff1ef` |
| `--color-base-20` | `#e8ebe8` |
| `--color-base-25` | `#dde2de` |
| `--color-base-30` | `#d1d7d2` |
| `--color-base-35` | `#c4cbc5` |
| `--color-base-40` | `#aeb7b0` |
| `--color-base-50` | `#8b958e` |
| `--color-base-60` | `#68756d` |
| `--color-base-70` | `#4e5b53` |
| `--color-base-100` | `#28302c` |

深色基础色阶：

| Token | 值 |
| --- | --- |
| `--color-base-00` | `#171c19` |
| `--color-base-05` | `#1a201c` |
| `--color-base-10` | `#202720` |
| `--color-base-20` | `#262e29` |
| `--color-base-25` | `#2d3630` |
| `--color-base-30` | `#364139` |
| `--color-base-35` | `#414d45` |
| `--color-base-40` | `#526058` |
| `--color-base-50` | `#6d7b72` |
| `--color-base-60` | `#95a39b` |
| `--color-base-70` | `#bbc7c0` |
| `--color-base-100` | `#dce4df` |

默认强调色：

| 模式 | Hex | HSL 变量 |
| --- | --- | --- |
| 浅色 | `#3f725b` | `152.9 / 28.8% / 34.7%` |
| 深色 | `#76b795` | `148.6 / 31.1% / 59.0%` |

核心对比度：

| 组合 | 对比度 |
| --- | ---: |
| 浅色正文 / 主背景 | `12.72:1` |
| 浅色次级文字 / 主背景 | `4.53:1` |
| 浅色默认强调色 / 主背景 | `5.23:1` |
| 深色正文 / 主背景 | `13.32:1` |
| 深色次级文字 / 主背景 | `6.57:1` |
| 深色默认强调色 / 主背景 | `7.38:1` |

所有组合达到普通文本 WCAG AA。最终 CSS 使用官方基础色、语义色和强调色变量组织，不在元素选择器中散落固定颜色。

## 6. 正文元素设计

### 6.1 标题与文内标题

标题通过官方 `--h1-*` 至 `--h6-*` 和 `--inline-title-*` 变量定义。字号使用相对单位，随用户正文字号缩放。

| 层级 | 字号 | 字重 | 行高 |
| --- | ---: | ---: | ---: |
| Inline title | `2em` | `650` | `1.25` |
| H1 | `1.85em` | `650` | `1.28` |
| H2 | `1.42em` | `650` | `1.35` |
| H3 | `1.16em` | `600` | `1.4` |
| H4 | `1.05em` | `600` | `1.45` |
| H5 | `1em` | `600` | `1.5` |
| H6 | `0.9em` | `600` | `1.5` |

H1 至 H5 使用正文色；H6 使用次级文字色。标题不添加装饰线、背景块或负字距。

### 6.2 行内元素与链接

- 粗体使用 `--bold-modifier: 200`，不写死统一粗体重量。
- 斜体继承正文颜色，不强制中文倾斜效果以外的装饰。
- 高亮使用低饱和暖黄色 `--text-highlight-bg`，不依赖墨绿。
- 内部与外部链接使用官方链接变量，并从用户强调色派生。
- 默认链接不使用粗重装饰；悬停状态显示下划线。
- 未解析链接保留可辨识的虚线或点状装饰，不只依靠透明度区分。

### 6.3 引用、列表与任务

- 引用使用透明背景、2px 起始边框、正常字形和次级文字色。
- 列表缩进、间距、标记颜色和序号样式均使用官方列表变量。
- 复选框使用 4px 圆角和用户强调色。
- 已完成任务使用次级文字色与删除线，同时保留可读性。

### 6.4 代码

- 行内代码与代码块使用官方代码背景和字号变量。
- 代码字号为正文的 `0.88em`，不覆盖用户等宽字体。
- 代码块使用 1px 边框和 6px 圆角。
- 长代码保持原生横向滚动。
- 编辑模式与阅读模式使用不同高亮库，因此目标是语义色一致而非像素级一致。

### 6.5 Callout、表格、标签、属性、嵌入与脚注

- Callout 使用官方 Callout 变量，6px 圆角、低透明背景和轻边框。
- 不同 Callout 类型保留各自语义色，不统一改成墨绿。
- 表格使用 1px 边框、次级表头背景和相对字号；长表格保持原生滚动。
- 标签使用 4px 圆角、轻边框和次级背景，不做大胶囊外观。
- Properties 使用官方 metadata 变量，弱化分隔线和标签色，不隐藏属性。
- 嵌入使用起始边界表达来源，不包装成独立浮层卡片。
- 脚注使用官方 `--footnote-size` 和次级文字色。
- 分隔线使用 1px 低对比边框。

## 7. 源码架构

```text
obsidian-aera-theme/
├── src/
│   ├── theme.scss
│   ├── foundations/
│   │   ├── _colors.scss
│   │   ├── _typography.scss
│   │   └── _spacing.scss
│   ├── editor/
│   │   ├── _headings.scss
│   │   ├── _inline.scss
│   │   ├── _lists.scss
│   │   ├── _quotes.scss
│   │   └── _code.scss
│   ├── components/
│   │   ├── _callouts.scss
│   │   ├── _tables.scss
│   │   ├── _metadata.scss
│   │   ├── _embeds.scss
│   │   └── _tags.scss
│   └── platforms/
│       └── _mobile.scss
├── scripts/
│   ├── check-theme.mjs
│   └── check-contrast.mjs
├── fixtures/
│   └── Theme Playground.md
├── theme.css
├── manifest.json
├── versions.json
├── package.json
├── README.md
├── LICENSE
└── .github/workflows/
    ├── checks.yml
    └── release.yml
```

职责边界：

- `body` 定义明暗模式共用的字体、行高、段落和组件尺寸。
- `.theme-light` 与 `.theme-dark` 定义颜色及模式相关值。
- SCSS 变量只消除源码重复；Obsidian 官方 CSS 变量仍是运行时接口。
- `_mobile.scss` 只包含真实移动端问题的修正，不复制一套视觉系统。
- 根目录 `theme.css` 是构建产物和正式发行文件，不直接手工编辑。
- 任何选择器例外都必须在源码中说明缺失的官方变量、影响视图和验证平台。

## 8. Manifest 与版本策略

主题 Manifest 仅使用主题支持的字段：

```json
{
  "name": "Aera",
  "version": "0.1.0",
  "minAppVersion": "1.12.7",
  "author": "Peter"
}
```

`description` 是插件专属 Manifest 字段，因此不写入主题 Manifest。品牌描述写入 README 首段和 Community Themes 提交信息。

版本策略：

- 开发阶段从 `0.1.0` 开始。
- 首次社区发布使用 `1.0.0`。
- `package.json`、`manifest.json`、Git tag 和 GitHub Release 使用相同版本。
- `versions.json` 将每个主题版本映射到实际测试的最低 Obsidian 版本。
- 初始最低测试版本为本机已安装并验证的 `1.12.7`；只有完成旧版本验证后才降低该值。
- 主题名称提交社区目录后不可更改。

## 9. 构建与失败处理

开发依赖使用 Dart Sass。核心命令：

```text
npm run dev    监听 SCSS 并生成 theme.css
npm run build  生成无 source map 的 theme.css
npm run check  构建并执行项目约束检查
```

Sass 使用 `--no-error-css`，编译失败时不以错误页面覆盖有效主题产物。失败处理：

- SCSS 编译错误：命令返回非零状态，CI 停止。
- 构建产物与源码不一致：检查失败，要求重新构建并提交 `theme.css`。
- Manifest 或版本映射无效：检查失败，不创建 Release。
- 出现远程 URL、`!important` 或未经批准的 `:has()`：检查失败。
- 核心颜色对比度低于 WCAG AA：检查失败。
- Release tag 与 Manifest 版本不一致：发布工作流失败。
- Release 缺少 `manifest.json` 或 `theme.css`：发布工作流失败。

## 10. 真实 Obsidian 预览

使用独立测试 Vault，不在个人主 Vault 中开发。测试 Vault 路径通过环境变量 `AERA_TEST_VAULT` 提供，并建立符号链接：

```bash
ln -s "$PWD" "$AERA_TEST_VAULT/.obsidian/themes/Aera"
```

主题目录名必须与 Manifest 的 `Aera` 完全一致。首次创建或修改 Manifest 后重启 Obsidian；普通 `theme.css` 改动由 Obsidian 自动加载，必要时执行：

```bash
obsidian vault="Aera Dev" reload
```

本机 Obsidian 与 installer 均为 `1.12.7`，CLI 可用。验证命令包括：

```bash
obsidian vault="Aera Dev" dev:errors
obsidian vault="Aera Dev" dev:css selector=".markdown-reading-view" prop="line-height"
obsidian vault="Aera Dev" dev:screenshot path="/tmp/aera-preview.png"
obsidian vault="Aera Dev" dev:mobile on
obsidian vault="Aera Dev" dev:mobile off
```

`fixtures/Theme Playground.md` 覆盖所有首版正文元素，作为稳定的视觉测试内容。

## 11. 验证矩阵

每次准备发布时验证以下组合：

- 浅色与深色模式
- Live Preview、Reading View 与 Source Mode
- 可读行长开启与关闭
- 默认字号与放大字号
- Aera 默认墨绿与用户自定义强调色
- 宽窗口、窄分栏与移动端模拟
- 鼠标、键盘焦点与触控状态
- 长表格、长代码、嵌套列表与嵌套 Callout
- 中文为主与少量中英文混排
- 用户自定义正文和等宽字体
- 一条无 `!important` 的测试 Snippet 能覆盖主题值

视觉问题必须回到对应 SCSS 模块修复并重新构建，不直接修改 `theme.css`。

## 12. 发布流程

1. `npm run check` 通过。
2. 更新 `package.json`、`manifest.json` 和 `versions.json`。
3. 提交最新的 `theme.css`、README、LICENSE 和截图。
4. 创建与 Manifest 版本一致的 Git tag。
5. GitHub Actions 创建 draft Release，并上传 `manifest.json` 与 `theme.css`。
6. 在真实 Obsidian 中安装 Release 资产并完成最终检查。
7. 发布 Release。
8. 首次 `1.0.0` 发布后，通过 Community Themes 提交流程提交仓库。

社区发布所需仓库文件：

- `README.md`
- MIT `LICENSE`
- `512 × 288`、16:9 的主题截图
- `manifest.json`
- GitHub Release 中的 `manifest.json` 与 `theme.css`

## 13. 成功标准

Aera 首版完成必须同时满足：

1. 完整正文范围中的所有元素在浅色和深色模式下可辨识、可读且层级一致。
2. Live Preview 与 Reading View 保持相同视觉语言，Source Mode 保持可用。
3. 用户字号、可读行长、字体、强调色和 Snippets 均能正常覆盖主题默认值。
4. 桌面宽窗口、窄分栏和移动端模拟中不存在横向页面溢出或文字遮挡。
5. 核心文本和强调色达到 WCAG AA。
6. 主题不包含远程资源、JavaScript、`!important` 或首版禁止的复杂选择器。
7. `npm run check` 与 GitHub Actions 检查全部通过。
8. GitHub Release 的版本和资产符合 Obsidian 社区主题要求。
