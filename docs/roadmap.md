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
| [SPEC-0018 客户端统计 V2](specs/0018-installation-metrics.md) | 保留 EdgeOne KV + HLL，收敛为日活跃、版本/渠道/OS 分布、日新增与新增渠道；V2 已于 2026-11-18 部署到 EdgeOne，94 项统计测试与 `pnpm verify` 通过；平台日志/区域/域名核验仍待控制台完成 |
| [SPEC-0021 圆形休息卡（环形进度）](specs/0021-circular-break-card.md) | 默认保持矩形，新增可选圆形、形状设置与环形进度渲染；形状从下一次休息生效，`pnpm verify` 通过，Windows 人工验收通过（2026-11-13） |
| [SPEC-0025 公开客户端统计报表读取性能](specs/0025-public-report-read-performance.md) | V2 将公开前缀收敛为 `h_act_`、`h_ver_`、`h_newch_` 并已部署；首次 TTFB 约 7d `2.73s`、30d `6.51s`、90d `14.83s`，7d 重复请求约 `2.96s`，Cache API 命中与长范围延迟仍需优化 |
| [SPEC-0026 公开报表定时预聚合快照](specs/0026-public-report-snapshot-refresh.md) | 已被客户端统计 V2 的接口前提部分取代；当前不实施，若重新评估需按单一日报表重写 |
