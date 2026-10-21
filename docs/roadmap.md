# 开发计划

## 里程碑

- [x] **M0｜仓库与文档基线** —— 目录结构、`AGENTS.md`、文档骨架、跨设备 Git 基线（SPEC-0001）
- [x] **M1｜需求梳理** —— `docs/overview.md` 范围/非目标 + `docs/specs/*`（SPEC-0002 ~ SPEC-0010）
- [x] **M2｜目标架构设计** —— `docs/architecture.md` 已补目标架构与差异；产出 ADR-0002（Electron → Tauri v2）
- [x] **M3｜技术选型与 `app/` 初始化** —— Tauri v2 工程可运行，IPC、插件/托盘骨架与设置持久化后端已完成（PLAN-0001）
- [x] **M4｜功能重构** —— 阶段 1/2/3/4 已完成；阶段 4「系统集成」Windows 人工验收通过，
  当前仅面向 Windows；A12/A13 与 D 组自启动转入 M5 发布产物与真实使用验证
  （见 `docs/plans/0002-implementation-phases.md`）
- [ ] **M5｜测试与 Windows 打包发布** —— 生成 Windows 发布产物，验收自启动、发布后状态展示与安装流程

## 当前重点

M4 已完成：阶段 4 的全部 Windows 功能验收项通过，C0-C2、C5-C7 与 C3/C4 均已完成人工验证；Popup 激活休息覆盖所有显示器并阻断任务栏/托盘输入，仅通过 `Cancel Break` 退出（ADR-0007）。macOS/Linux 暂不纳入当前范围。下一步进入 M5：生成 Windows 发布产物，并在打包后实际使用中验证 A12/A13 与 D 组自启动。
