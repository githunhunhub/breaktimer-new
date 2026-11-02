# 2026-11-02 停用 Gitee 远程，仅保留 GitHub

## 背景

承接同日的 About 链接修正：用户确认 Gitee 后续不再使用，要求完成彻底退役，再把
`develop` 推送到远程（只推 GitHub）。

## 决策

- 新增 `docs/decisions/0017-gitee-decommission.md`：GitHub 成为唯一远程仓库与发布平台，
  取代 ADR-0014 全部结论及 ADR-0015 中 Gitee 备份 / 双远程推送部分；ADR-0015 的
  `develop` / `master` 分支模型不变。
- 旧 ADR 不修改，按「ADR 只增不改」保留历史。

## 改动

- `app/scripts/release.ps1`：删除对 `origin` 的 fetch、落后检查和 `master` 推送，只使用
  `github/master`；确认提示与步骤文案同步更新。
- `README.md`：下载说明只提 GitHub Releases。
- `DEVELOPMENT.md`：克隆地址改 GitHub；删除双远程推送与 Gitee 备份描述；发布步骤只推 GitHub。
- `docs/specs/0015-github-tag-release.md`：需求、R12、非目标与变更记录同步。
- `docs/specs/README.md`、`docs/architecture.md`、`docs/plans/0004-github-tag-release.md`
  同步索引与边界描述。
- 本地 Git 配置执行 `git remote remove origin`，仅保留 `github`。

## 验证

- `app/` 下完整门禁通过（同日前一次运行：前端 74 tests、Rust 108 tests，加 `pnpm build`）。
- `git remote -v` 只剩 `github`。
- 全仓库检索确认只剩历史 ADR / 变更记录中的 Gitee 表述，无当前流程引用。

## 后续

- `develop` 推送到 `github`，不再推送 Gitee。
