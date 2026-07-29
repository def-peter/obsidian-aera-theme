# Issue tracker: GitHub

本仓库的 issue 和 PRD 存放在 GitHub Issues 中。所有操作均使用 `gh` CLI。

## Conventions

- **创建 issue**：`gh issue create --title "..." --body "..."`。多行正文使用 heredoc。
- **读取 issue**：`gh issue view <number> --comments`，同时获取 labels，并按需使用 `jq` 过滤 comments。
- **列出 issues**：使用 `gh issue list`，按需指定 `--label`、`--state` 和 JSON fields。
- **评论**：`gh issue comment <number> --body "..."`
- **添加/移除 label**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭**：`gh issue close <number> --comment "..."`

通过 `git remote -v` 推断 repo；在 clone 内运行时，`gh` 会自动完成此操作。

## Pull requests as a triage surface

**PRs as a request surface: no.**

_若本仓库以后需要将外部 PR 视为 feature request，可将其改为 `yes`。_

GitHub Issues 与 Pull Requests 共用编号空间。遇到含义不明确的 `#<number>` 时，先运行 `gh pr view <number>`，失败后再运行 `gh issue view <number>`。

## Skill operations

- “publish to the issue tracker”：创建 GitHub issue。
- “fetch the relevant ticket”：运行 `gh issue view <number> --comments`。
- `/wayfinder` 的 map 使用带有 `wayfinder:map` label 的 issue，并关联 child issues。
- child issue 类型使用 `wayfinder:<type>` labels：`research`、`prototype`、`grilling` 或 `task`。
- blocker 优先使用 GitHub native issue dependencies；不可用时，使用 `Blocked by: #<n>`。
- 使用 `gh issue edit <number> --add-assignee @me` 认领工作。
- 完成后评论处理结果、关闭 child issue，并在 map 中记录 context pointer。
