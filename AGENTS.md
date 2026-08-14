## Agent skills

### Issue tracker

本仓库的 issue 和 PRD 使用 GitHub Issues 管理。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用五个默认的 canonical triage labels。详见 `docs/agents/triage-labels.md`。

### Domain docs

本仓库采用 single-context domain documentation layout。详见 `docs/agents/domain.md`。

## Git 与发布约定

- 用户说“推送”时，表示将本次相关修改提交并推送到当前项目的远程代码仓库，不是只在本地创建提交。
- 用户说“发布”时，表示创建并正式发布一个 GitHub Release，不是只推送标签或保留草稿 Release。
- 一般完成推送后，如果用户没有同时要求发布，需要询问用户是否还要发布 Release。
- 推送或发布前检查版本号是否已递增；如果本次修改尚未增加版本号，需要主动提醒用户。发布时应先确认或补充版本号，再创建对应标签和 Release。
