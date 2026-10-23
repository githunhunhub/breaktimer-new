# SPEC-0015：GitHub Tag 发布流水线

- 状态：in-progress
- 日期：2026-10-23
- 关联：ADR-0013 · PLAN-0004 · SPEC-0011 · SPEC-0012

## 背景 / 问题

Windows 安装包和便携 ZIP 目前依赖本地手工执行多条构建命令，发布产物、变更日志和
GitHub Release 之间没有统一的自动流程。应用版本同时存在于 `package.json`、
`tauri.conf.json`、`Cargo.toml` 和 `Cargo.lock`，手工发布容易生成版本混合或漏传产物。

## 需求（做什么）

1. 推送形如 `vMAJOR.MINOR.PATCH` 的 Tag 是 GitHub Release 的唯一自动触发条件；普通分支或
   `master` 提交不得触发发布。
2. Tag 指向的提交必须已包含在 GitHub `master` 分支历史中；`vX.Y.Z` 的 `X.Y.Z` 必须与
   `app/package.json`、`app/src-tauri/tauri.conf.json`、`app/src-tauri/Cargo.toml` 和
   `app/src-tauri/Cargo.lock` 中 `breaktimer-new` 包的版本完全一致。
3. 提供共享版本检查脚本和本地发布脚本：
   - `pnpm release:version <version>` 只更新四处版本，不创建提交或 Tag；
   - `pnpm release:check v<version>` 校验 Tag 与四处版本一致；
   - `pnpm release:tag <version>` 仅在 `master`、工作区干净、与上游同步、版本一致且 Tag
     不存在时创建 annotated Tag，不自动推送。
4. GitHub Actions 在构建前独立重复 Tag、master 祖先关系和版本一致性校验；校验失败时不得
   进入打包或发布。
5. Windows 构建 Job 必须完成前端格式、Lint、类型检查、测试、生产构建，以及 Rust 格式、
   Check 和测试；之后从同一份 release executable 生成便携 ZIP和 NSIS 安装包。
6. 使用 `git-cliff` 从 Conventional Commits 生成当前 Tag 相对上一发布 Tag 的变更日志；
   日志为空时发布失败。
7. 只有校验、Windows 构建和变更日志全部成功后才创建 GitHub Release。Release 应上传 NSIS、
   便携 ZIP、`CHANGES.md` 和 `SHA256SUMS.txt`，正文使用生成的变更日志。
8. Workflow 默认只读仓库内容，仅创建 Release 的 Job 获得 `contents: write`。
9. 当前流水线只支持 Windows x64、未签名 NSIS 与便携 ZIP；不包含代码签名、自动更新、
   macOS/Linux 构建或 Gitee 自动镜像。

## 验收标准（可测）

- [x] **R1** `pnpm release:check v0.1.0` 在当前四处版本均为 `0.1.0` 时通过。
- [x] **R2** 任一版本文件与 Tag 不一致时，检查脚本以非零状态退出并指出不一致文件。
- [x] **R3** 版本脚本单元测试覆盖合法/非法 SemVer、Cargo 版本定位和四处版本比较。
- [x] **R4** `release:tag` 拒绝非 `master`、工作区不干净、与上游不同步、版本不一致或本地/
      远程 Tag 已存在的状态。
- [x] **R5** Workflow 仅声明 Tag Push 触发，不含 `push` 分支、PR 或手工触发入口。
- [x] **R6** Workflow 在 Ubuntu 元数据 Job 中校验 Tag 格式、Tag 提交属于 `master` 且四处
      版本一致。
- [x] **R7** Windows 构建 Job 运行完整自动化门禁，并生成 NSIS、便携 ZIP 和 SHA-256 校验文件。
- [x] **R8** 变更日志 Job 使用 `.github/cliff.toml`、完整 Git 历史和 `--latest` 生成非空
      当前版本日志。
- [x] **R9** Release Job 依赖校验、构建和变更日志 Job；任一前置失败时不创建 Release。
- [x] **R10** Workflow 通过 `actionlint` 静态校验，YAML 可被仓库格式化检查接受。
- [ ] **R11** 推送首个正式 `v0.1.0` Tag 后，GitHub Actions 按 Tag 自动完成构建并创建公开
      Release，上传四类资产；该端到端验证留待用户明确发布时执行。

## 非目标 / 边界

- 不自动修改版本文件或自动创建版本提交。
- 不自动推送 Tag；本地脚本只创建 Tag。
- 不自动发布到 Gitee，也不维护 Gitee 与 GitHub 双流水线。
- 不生成 macOS/Linux 产物。
- 不添加代码签名、公证、SBOM、自动更新或 Release 草稿审批。
- 不把安装包、便携 ZIP 或 `CHANGES.md` 提交进 Git。

## 设计要点

- Tag 是发布的身份来源，但 Tag 必须由已提交的四处版本文件支撑；CI 不静默改写版本。
- 本地脚本负责减少人工操作错误，CI 负责独立守门，不能只依赖本地脚本。
- 单一 `.github/workflows/release.yml` 串联 `meta -> build/changelog -> release`，减少跨
  Workflow 状态传递。
- `git-cliff` 只从 Conventional Commits 提取日志；非 Conventional 的合并提交不进入正文。
- NSIS 在便携 ZIP 生成后通过 `tauri bundle --no-binary-patching` 复用同一 release
  executable，避免两套安装包来自不同构建。

## 实现计划

详细任务、接口和验证命令见 [PLAN-0004](../plans/0004-github-tag-release.md)。

- [x] 创建 SPEC、ADR 与实施计划。
- [x] 实现四处版本更新/校验脚本及单元测试。
- [x] 实现本地发布 Tag 脚本与 package scripts。
- [x] 配置 `git-cliff` 和 GitHub Release Workflow。
- [x] 执行静态检查、自动化测试与文档收口。
- [ ] 首个正式 Tag 的 GitHub Actions 端到端验收。

## 变更记录

| 日期       | 变更                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-23 | 创建并确认；采用严格版本一致性和单一 Tag 发布流水线                                                                                                                    |
| 2026-10-23 | 本地脚本、Workflow 与静态验证完成：版本脚本 16 tests、前端 70 tests、Rust 107 tests、`actionlint` 与 `git-cliff --latest` 模拟均通过；未创建 Tag，等待正式发布验收 R11 |
