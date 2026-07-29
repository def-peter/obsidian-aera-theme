# Domain Docs

本文规定 engineering skills 在探索 codebase 时应如何读取本仓库的 domain documentation。

## Before exploring, read these

- 仓库根目录的 `CONTEXT.md`；如果存在 `CONTEXT-MAP.md`，则读取其中指向的相关 `CONTEXT.md`。
- `docs/adr/` 中与当前工作范围相关的 ADR。
- 在 multi-context repo 中，还需检查相关 context 的 `CONTEXT.md` 和 `src/<context>/docs/adr/`。

如果这些文件不存在，直接继续，不需要提示缺失。Domain-modeling skills 会在术语或决策真正明确后按需创建它们。

## File structure

本仓库使用 single-context layout：

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

输出中涉及 domain concept 时，应使用 `CONTEXT.md` 定义的术语，不要改用 glossary 明确排除的同义词。

如果 glossary 中没有所需概念，应重新判断该概念是否属于项目；若确实缺失，则记录并交由 `/domain-modeling` 处理。

## Flag ADR conflicts

如果输出与现有 ADR 冲突，必须明确指出，不得静默覆盖既有决策。
