# 2026-10-13 技术选型与全屏遮挡方案确认

## 结论

- 技术栈确定：**Tauri v2（Rust）+ 前端保留 React + TypeScript**（ADR-0002）。
- 关键能力「强制全屏阻塞」经读旧源码确认为 **soft overlay（软遮挡）**：全屏覆盖层置顶、跨工作区、不抢焦点，但不锁输入、不阻止 Alt+Tab。
- Tauri v2 官方窗口 API 可完整复刻，且 `setFullscreenOnMonitor` 比旧版 `setSize(bounds)` 更原生。

## 完成

- 新增 `docs/decisions/0002-technology-stack.md`。
- 补全 `docs/overview.md`（范围/非目标）、`docs/architecture.md`（目标架构与差异表）、`docs/glossary.md`（术语）。
- 更新 `docs/roadmap.md` 与 `.ai/memory.md`。
- 确认全屏休息窗为软遮挡 + 允许手动结束，写入 `docs/specs/0002-break-window-fullscreen-overlay.md`（状态 confirmed）。
- 补齐剩余需求 spec：SPEC-0003 休息调度 / 0004 工作时段 / 0005 闲置重置 / 0006 系统托盘 / 0007 自启动 / 0008 通知模式 / 0009 声音 / 0010 设置持久化与设置窗口。

## 待办

- 初始化 `app/` Tauri 工程，按 spec 逐个实现。
