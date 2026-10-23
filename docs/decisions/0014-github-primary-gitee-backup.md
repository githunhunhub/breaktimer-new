# ADR-0014：GitHub 主仓库与 Gitee 纯备份

- 状态：accepted
- 日期：2026-10-23
- 决策者：项目维护者
- 关联：SPEC-0015 · ADR-0013

## 背景

项目同时维护 GitHub 与 Gitee 远程。GitHub Actions 负责校验、Windows 构建、变更日志和
Release；Gitee 继续使用开发分支和 Tag 会让发布身份、自动化和用户下载入口出现两套来源。

## 决策

1. GitHub 是唯一主仓库和正式发布平台。
2. 日常开发完成后，`master` 同时推送到 GitHub 与 Gitee，Gitee 作为代码备份。
3. 发布 Tag 只创建一次并推送到 GitHub，用于触发正式 Release。
4. 不把发布 Tag 推送到 Gitee，不在 Gitee 创建对应的正式 Release。
5. 单命令发布脚本可以把 `master` 推送到两个远程，但最后只执行
   `git push github <tag>`。

## 理由

- 正式版本、Release 正文、安装包和哈希只有一个权威来源，避免双平台发布状态漂移。
- Gitee 仍保留完整 `master` 源码，具备代码级备份价值，但不再承担发布职责。
- 开发者只需要记住 GitHub Tag 这一条正式发布路径。

## 考虑过的替代方案

- **双远程同时推送 Tag**：Tag 和 Release 的权威来源不唯一，失败时还容易出现只在一边
  发布成功的半完成状态。
- **Gitee 自动镜像 Tag 和 Release**：需要额外凭据、工作流和产物同步机制，与“备份仓库”
  的目标不匹配。
- **只保留 GitHub**：会失去现有 Gitee 代码备份，不符合维护者要求。

## 影响

- Gitee 的 Tag 可能少于 GitHub，这是预期行为，不视为同步失败。
- 用户和文档只指向 GitHub Releases 下载正式产物。
- `master` 推送失败到 Gitee 时，发布入口应在创建 GitHub Tag 前停止并报告备份失败。
