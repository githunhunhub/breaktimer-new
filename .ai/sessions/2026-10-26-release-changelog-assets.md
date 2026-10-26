# 2026-10-26 Release 变更日志与资产边界

## 需求

- 后续流水线生成的 `CHANGES.md` 不再上传为 GitHub Release Assets。
- 变更日志标题使用带 `v` 的版本号，例如 `## BreakTimer-new v0.1.1`。

## 修改

- `.github/cliff.toml` 保留 Tag 版本号前缀。
- `.github/workflows/release.yml` 不再上传/下载 changelog artifact，Release 标题同步使用
  `github.ref_name`，Assets 只包含 NSIS、便携 ZIP 和 `SHA256SUMS.txt`。
- 同步更新 SPEC-0015、PLAN-0004、架构文档与开发文档。
- 已发布的 `v0.1.1` 不再调整；其 Assets 当前仍包含 `CHANGES.md`，新规则从下一次
  Release 开始生效。

## 验证

- `git-cliff 2.14.2` 使用真实 Tag 历史渲染，首行为 `## BreakTimer-new v0.1.1`。
- `actionlint 1.7.12`、`pnpm format:check` 与版本脚本 19 项测试通过。
- 待下一次正式 Tag 验证 R14：正文标题带 `v`，Assets 中不含 `CHANGES.md`。
