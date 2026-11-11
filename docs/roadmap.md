# 开发计划

> 本文件只管**里程碑级**状态。单个需求的进度与验收以对应 SPEC 头部和
> `docs/specs/README.md` 为准，不再在这里复述。

## 里程碑

- [x] **M0｜仓库与文档基线** —— 目录结构、`AGENTS.md`、文档骨架、跨设备 Git 基线（SPEC-0001）
- [x] **M1｜需求梳理** —— `docs/overview.md` 范围/非目标 + `docs/specs/*`（SPEC-0002 ~ SPEC-0010）
- [x] **M2｜目标架构设计** —— `docs/architecture.md` 目标架构与差异；产出 ADR-0002（Electron → Tauri v2）
- [x] **M3｜技术选型与 `app/` 初始化** —— Tauri v2 工程可运行，IPC、插件/托盘骨架与设置持久化后端（PLAN-0001）
- [x] **M4｜功能重构** —— 阶段 1-4 完成，Windows 人工验收通过（PLAN-0002）
- [x] **M5｜测试与 Windows 打包发布** —— NSIS 与便携 ZIP 完成构建与人工验收，`v0.1.1` 已发布

## 当前重点

M0-M5 已完成，重构阶段结束。日常开发在 `develop`，`master` 只用于发版。
新功能或问题按「需求确认 → 新建/更新 SPEC → 实现与验证」推进，不再以大阶段重构任务组织。
macOS/Linux 不在当前范围。

## 后续需求

只列未完成的需求；完成后从本表移除，状态与验收记录留在对应 SPEC。

| 需求 | 范围与下一步 |
| --- | --- |
| [SPEC-0015 GitHub Tag 发布流水线](specs/0015-github-tag-release.md) | 版本校验、构建、`git-cliff` 变更日志与 Release；待下一次正式 Tag 端到端验收 |
| [SPEC-0017 更新检查](specs/0017-update-check.md) | 启动后自动检查 + 设置页手动检查；待 Windows 人工验收与网盘链接补齐 |
| [SPEC-0018 装机统计](specs/0018-installation-metrics.md) | EdgeOne Edge Functions + KV HLL 的 M1～M8 近似统计；客户端上报已按构建期开关暂时屏蔽，待端点部署后打开并做 Windows 人工验收 |
| [SPEC-0019 本地诊断日志](specs/0019-local-diagnostic-logs.md) | 本机滚动日志，不上报；待 Windows 人工验收 |
