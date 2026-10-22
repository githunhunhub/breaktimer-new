# 开发计划

## 里程碑

- [x] **M0｜仓库与文档基线** —— 目录结构、`AGENTS.md`、文档骨架、跨设备 Git 基线（SPEC-0001）
- [x] **M1｜需求梳理** —— `docs/overview.md` 范围/非目标 + `docs/specs/*`（SPEC-0002 ~ SPEC-0010）
- [x] **M2｜目标架构设计** —— `docs/architecture.md` 已补目标架构与差异；产出 ADR-0002（Electron → Tauri v2）
- [x] **M3｜技术选型与 `app/` 初始化** —— Tauri v2 工程可运行，IPC、插件/托盘骨架与设置持久化后端已完成（PLAN-0001）
- [x] **M4｜功能重构** —— 阶段 1/2/3/4 已完成；阶段 4「系统集成」Windows 人工验收通过，
  当前仅面向 Windows；D 组自启动、A12/A13 已在 M5 发布产物中通过
  （见 `docs/plans/0002-implementation-phases.md`）
- [x] **M5｜测试与 Windows 打包发布** —— NSIS 与免安装便携 ZIP 已完成最终构建与人工验收；
  三项便携反馈修复、完整便携流程、安装版互斥、便携自启动与发布后状态均通过

## 当前重点

M0-M5 已全部完成，重构阶段结束。当前 Windows 发布产物、便携版与相关 spec 均已验收通过；
后续新功能或问题按「需求确认 → 新建/更新 SPEC → 实现与验证」的正常开发流程处理，
不再以大阶段重构任务推进。macOS/Linux 仍不在当前范围。
