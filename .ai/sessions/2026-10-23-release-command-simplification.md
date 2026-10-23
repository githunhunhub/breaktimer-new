# 2026-10-23 单命令发布入口

- 状态：实现与安全拒绝路径验证完成；0.2.0 正式演练未执行
- 关联：SPEC-0015 · ADR-0014 · PLAN-0004

## 需求变化

- 将原本需要多步执行的版本更新、测试、提交、双远程分支推送、Tag 创建和 Tag 推送合并为
  `pnpm release <version>`。
- GitHub 是唯一主仓库和发布平台；Gitee 只备份 `master`，不接收发布 Tag 或 Release。
- 发布入口在真正执行前只要求一次 `y` 确认。

## 实现

- 新增 `app/scripts/release.ps1`，复用 `release:version`、`release:check` 和
  `release-tag`。
- 发布前检查 `master`、`github/master` upstream、工作区干净和双远程历史；GitHub 已存在
  同名 Tag 时拒绝继续。
- 版本更新前运行完整前端与 Rust 门禁；版本有变化时提交
  `chore(release): 发布 <version>`。
- `master` 推送到 GitHub 和 Gitee；发布 Tag 只推送到 GitHub。
- 确认前取消或失败时恢复脚本修改的四处版本文件。
- `package.json` 增加 `pnpm release <version>` 入口。
- `DEVELOPMENT.md` 主发布流程改为单命令；README 明确 Gitee 仅作代码备份。
- 新增 ADR-0014，固化 GitHub 主仓库、Gitee 备份边界。

## 验证

- `release.ps1` 通过 PowerShell Parser 语法检查。
- 当前存在未提交文档时，`pnpm release 0.1.0` 在修改版本文件前以
  `Working tree is not clean` 拒绝；`package.json` 哈希未变化。
- 新增和更新的 Markdown/JSON 通过 Prettier。
- `v0.1.0` GitHub Actions 运行 `39916285967` 已成功，公开 Release 含 NSIS、便携 ZIP、
  `CHANGES.md` 与 `SHA256SUMS.txt`。

## 未执行

- 未运行 `pnpm release 0.2.0` 的完整交互式成功路径，因为它会提交、推送并创建正式 Tag。
- 未向 Gitee 推送任何 Tag。
- 本轮文件尚未提交或推送。
