# ADR-0013：GitHub Tag 发布流水线

- 状态：accepted
- 日期：2026-10-23
- 决策者：项目维护者
- 关联：SPEC-0015

## 背景

当前 Windows 发布依赖本地手工执行多条命令。版本号分布在多个生态文件中，变更日志尚未纳入
发布，GitHub Release 也没有自动化入口。需要一条只在明确 Tag 上运行、失败时不会误发布的
流水线。

有两种基本做法：

- Tag 是唯一版本源，CI 在构建前临时改写版本文件；
- Tag 与已提交的版本文件严格一致，CI 校验后才构建。

## 决策

1. 发布使用 `vMAJOR.MINOR.PATCH` annotated Tag，且只能指向 `master` 历史。
2. Tag 版本必须与四处已提交版本一致；CI 不自动改写文件。
3. 本地提供版本更新、检查和 Tag 创建脚本；CI 使用同一版本检查模块独立复验。
4. 单一 `.github/workflows/release.yml` 负责校验、Windows 构建、`git-cliff` 变更日志和
   GitHub Release。
5. 构建使用现有 `portable:build` 生成 release executable 与便携 ZIP，再以
   `tauri bundle --no-binary-patching` 从同一 executable 生成 NSIS。
6. Workflow 默认只读；只有 Release Job 具有 `contents: write`。
7. 发布为公开 Release，不使用草稿、预发布、代码签名或自动更新。

## 理由

- Tag 对应的源码与实际产物版本一致，克隆、审计和重新构建都不会出现“源码版本旧、Tag 版本新”
  的歧义。
- 本地脚本减少重复修改四处版本时的人为错误，但仍允许维护者在提交前审查全部版本变更。
- CI 独立校验可以阻止绕过本地脚本的 Tag。
- 单 Workflow 让 Job 依赖和权限边界清晰，出错时只需要检查一个运行记录。
- 从同一 release executable 生成 ZIP 与 NSIS，保持 SPEC-0011/SPEC-0012 的产物一致性要求。

## 考虑过的替代方案

- **CI 按 Tag 自动覆盖版本**：手工步骤更少，但 Tag 对应源码与发布产物版本不一致，放弃。
- **release-please 自动创建版本 PR 和 Tag**：能进一步自动化版本与日志，但会引入额外的机器
  提交、PR 权限和长期配置；当前只需要“已决定发布版本后推送 Tag”，暂不采用。
- **多个 Workflow 串联**：每个 Job 独立可重跑，但跨 Workflow 触发顺序、权限和状态传递更
  复杂，当前规模不值得。
- **GitHub 自动生成 Release Notes**：配置最少，但无法把提交严格分配到当前版本范围并按
  Conventional Commits 分组，因此使用 `git-cliff`。

## 影响

- 每次发布前仍需要提交版本变更并推送 `master`，确认同步后才能创建 Tag。
- Workflow 首次真正执行只能在正式 Tag 推送时验证；在此之前只能做脚本测试和静态校验。
- `git-cliff` 依赖规范提交信息；不合规提交会被忽略。
- 未签名安装包可能触发 Windows SmartScreen，后续若增加签名需要新 ADR 和 Secrets。
- Gitee Release 仍由现有手工流程维护，本次不建立双平台自动发布。
