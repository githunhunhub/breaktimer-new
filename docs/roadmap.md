# 开发计划

## 里程碑

- [x] **M0｜仓库与文档基线** —— 目录结构、`AGENTS.md`、文档骨架、跨设备 Git 基线（SPEC-0001）
- [x] **M1｜需求梳理** —— `docs/overview.md` 范围/非目标 + `docs/specs/*`（SPEC-0002 ~ SPEC-0010）
- [x] **M2｜目标架构设计** —— `docs/architecture.md` 已补目标架构与差异；产出 ADR-0002（Electron → Tauri v2）
- [x] **M3｜技术选型与 `app/` 初始化** —— Tauri v2 工程可运行，IPC、插件/托盘骨架与设置持久化后端已完成（PLAN-0001）
- [ ] **M4｜功能重构**（按模块拆分，见 `docs/plans/0002-implementation-phases.md`）
- [ ] **M5｜测试与打包发布**

## 当前重点

M4 —— 功能重构：以 PLAN-0002 的五阶段依赖顺序为准，从设置/生命周期地基开始，逐步实现调度、休息窗口、工作时间、闲置重置、托盘、通知、自启动与声音。每个 spec 完成后再推进到 `done`。
