# 2026-10-23 GitHub Tag 发布流水线

- 状态：本地实现与静态验证完成，等待首个正式 Tag 做 GitHub Actions 端到端验收
- 关联：SPEC-0015 · ADR-0013 · PLAN-0004 · SPEC-0011 · SPEC-0012

## 决策

- 发布 Tag 使用 `vMAJOR.MINOR.PATCH`，且必须指向 GitHub `master` 历史中的提交。
- Tag 和四处版本文件严格一致；CI 不在构建时自动改写版本。
- 本地脚本负责更新/校验版本和创建 annotated Tag，CI 独立复验，避免绕过本地脚本。
- 单一 `.github/workflows/release.yml` 串联 `meta -> build/changelog -> release`。
- Windows 构建先生成 release executable 与便携 ZIP，再复用 executable 生成 NSIS。
- `git-cliff` 生成当前 Tag 范围 Release Notes；所有前置 Job 成功后才创建公开 Release。

## 实现

- 新增 `app/scripts/release-version.mjs`：读取、校验和更新四处版本；JSON 只替换顶层
  `version`，Cargo 与 Cargo.lock 只替换目标包。
- 新增 `app/scripts/release-version.test.mjs`：覆盖 SemVer、JSON/Cargo 定位和版本比较。
- 新增 `app/scripts/release-tag.ps1`：检查版本、`master`、工作区、上游同步和 Tag 唯一性；
  只创建 Tag，不自动推送。
- 新增 `.github/cliff.toml`：按 Conventional Commits 分组，跳过合并和非规范提交。
- 新增 `.github/workflows/release.yml`：唯一 Tag 触发、最小权限、Windows 构建、日志上传和
  GitHub Release。
- README 下载/SmartScreen 入口切到 GitHub Releases，保留 Gitee 镜像说明。

## 验证

- `pnpm release:check v0.1.0`：通过，四处版本均为 `0.1.0`。
- `pnpm release:version 0.1.0`：通过，同版本写入未产生额外文件差异。
- 版本脚本聚焦测试：16 tests 通过。
- `pnpm release:tag 0.1.0`：脏工作区按预期拒绝，未创建 Tag。
- `actionlint 1.7.12`：Workflow 通过。
- `git-cliff 2.14.2`：配置可解析并生成 Markdown；临时仓库 `v0.1.0` 的 `--latest` 只包含
  上一测试 Tag 至当前 Tag 的提交。
- 前端：format、lint、typecheck、test（70）、build 全部通过。
- Rust：fmt、`cargo check --locked --all-targets`、107 tests 全部通过。
- `git diff --check`：通过。

## 未执行

- 未执行本地 Tauri/NSIS/便携 ZIP 打包；按仓库规则，打包仅由正式 Tag Workflow 在用户明确
  发布时执行。
- 未创建或推送 `v0.1.0`。
- GitHub Actions 的 Windows runner、Release 权限和资产上传尚未做真实端到端验证。

## 后续入口

1. 本轮变更按用户指令提交并推送到 GitHub/Gitee `master`。
2. 首次发布前确认本地 `master` 与 `github/master` 同步。
3. 执行 `pnpm release:tag 0.1.0`。
4. 执行 `git push github v0.1.0`。
5. 观察 Release Workflow，核对四个 Release 资产后勾选 SPEC-0015 R11。
