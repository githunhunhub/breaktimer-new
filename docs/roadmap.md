# 开发计划

## 里程碑

- [x] **M0｜仓库与文档基线** —— 目录结构、`AGENTS.md`、文档骨架、跨设备 Git 基线（SPEC-0001）
- [x] **M1｜需求梳理** —— `docs/overview.md` 范围/非目标 + `docs/specs/*`（SPEC-0002 ~ SPEC-0010）
- [x] **M2｜目标架构设计** —— `docs/architecture.md` 已补目标架构与差异；产出 ADR-0002（Electron → Tauri v2）
- [x] **M3｜技术选型与 `app/` 初始化** —— Tauri v2 工程可运行，IPC、插件/托盘骨架与设置持久化后端已完成（PLAN-0001）
- [x] **M4｜功能重构** —— 阶段 1/2/3/4 已完成；阶段 4「系统集成」Windows 人工验收通过，
  当前仅面向 Windows；D 组自启动已在 M5 发布产物中通过，A12/A13 继续等待发布后实际使用验证
  （见 `docs/plans/0002-implementation-phases.md`）
- [ ] **M5｜测试与 Windows 打包发布** —— 阶段 5 正在进行：NSIS 与免安装便携 ZIP 已生成
  并完成自动冒烟；NSIS 安装/卸载、图标、版本与登录自启动已通过人工验收，待完成便携
  ZIP 完整验收与发布后 A12/A13 状态展示

## 当前重点

M4 已完成并进入 M5 阶段 5：Theme/Backdrop、设置窗口关闭隐藏与托盘恢复已实现；
NSIS 安装包和免安装便携 ZIP 已生成，NSIS 安装/卸载、图标、版本与 D1-D4 登录自启动
已通过人工验收。下一步验证便携 ZIP 完整流程、安装版互斥与便携自启动（SPEC-0012），
再在发布产物中验证 A12/A13 状态展示（SPEC-0006）。macOS/Linux 暂不纳入当前范围。
