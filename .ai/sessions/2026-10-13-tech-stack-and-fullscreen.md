# 2026-10-13 技术选型与全屏遮挡方案确认

## 结论

- 技术栈确定：**Tauri v2（Rust）+ 前端保留 React + TypeScript**（ADR-0002）。
- 关键能力「强制全屏阻塞」经读旧源码确认为 **soft overlay（软遮挡）**：全屏覆盖层置顶、跨工作区、不抢焦点，但不锁输入、不阻止 Alt+Tab。
- Tauri v2 官方窗口 API 可完整复刻，且 `setFullscreenOnMonitor` 比旧版 `setSize(bounds)` 更原生。

## 完成

- 新增 `docs/decisions/0002-technology-stack.md`。
- 补全 `docs/overview.md`（范围/非目标）、`docs/architecture.md`（目标架构与差异表）、`docs/glossary.md`（术语）。
- 更新 `docs/roadmap.md` 与 `.ai/memory.md`。
- 新增学习笔记 `ai-notes/02-tauri-desktop-stack-and-windowing.md`。

## 待办

- 写首个功能 spec：`docs/specs/0002-break-window-fullscreen-overlay.md`（或含休息调度），引用 ADR-0002，明确验收标准。
