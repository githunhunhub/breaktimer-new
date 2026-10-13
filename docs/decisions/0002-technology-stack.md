# ADR-0002：技术栈选型 —— Electron → Tauri v2（Rust），前端保留 React + TypeScript

- 状态：已接受
- 日期：2026-10-13
- 决策者：项目作者

## 背景

本次重构有两个目标：探索 AI 编程实践，以及用更现代的技术栈替换旧项目的 Electron。

用户调研后倾向 Tauri 替换 Electron，要求确认是否合适，并强调一个不可丢失的能力：**休息时在每个显示器上显示「全屏遮挡层」**（旧版的 backdrop 模式），置顶、跨工作区、且不抢用户焦点。

经读旧源码确认，旧版 BreakTimer 的「全屏」实际是：

- `createBreakWindows()`：每个显示器一个无边框、透明、`focusable:false`、置顶的小窗，用 `showInactive()` 显示（**不抢焦点**）。
- 休息阶段 `BreakWindowResize`：若 `showBackdrop=true`，用 `window.setSize(display.bounds)` 手工把窗口铺满该显示器（不是系统级 `setFullScreen`）。

也就是说，旧版的「强制全屏阻塞」是**软遮挡**：全屏覆盖层挡住视线、限制分心，但**不抢焦点、不锁键盘鼠标、不阻止 Alt+Tab**。

## 决策

1. 用 **Tauri v2**（Rust 后端 + 系统 WebView）替换 Electron。
2. 前端保留 **React + TypeScript**，尽量复用旧 `app/renderer/` 的 UI 资产（Tailwind CSS + shadcn/ui）。
3. 全屏遮挡层用 Tauri v2 原生窗口能力复刻，且优先用比旧版更贴合系统原生的 API：
   - 每个显示器创建一个无边框、透明、置顶、跨工作区的 `WebviewWindow`。
   - 休息阶段调用 `setFullscreenOnMonitor(monitorPosition)`，让窗口在该显示器上**原生全屏**（旧版是手工 `setSize(bounds)`）。
   - 用 `setFocusable(false)` + `setSkipTaskbar(true)` + `setAlwaysOnTop(true)` + `setVisibleOnAllWorkspaces(true)` 复刻「不抢焦点、置顶、跨桌面」语义。
   - `showBackdrop=false` 时退化为居中 `500×300` 小窗（与旧版一致）。
4. 后端能力（休息调度、系统空闲检测、托盘、设置持久化、自启动、通知）用 **Rust** 实现，通过 Tauri command/IPC 暴露给前端。

## 理由

- Tauri v2 官方 `namespacewindow` 已确认提供全部所需 API：`setFullscreenOnMonitor`、`setFocusable`、`setAlwaysOnTop`、`setVisibleOnAllWorkspaces`、`setSkipTaskbar`、`setDecorations`、`setFocus` 等（2026-10 核对官方参考）。
- 打包体积与内存占用优于 Electron（不再捆绑 Chromium + Node 运行时），符合「现代化替代」目标。
- 前端复用显著降低迁移成本；Rust 后端是 Tauri 官方路径，对「后台调度 + 托盘 + 跨平台」足够。
- `setFullscreenOnMonitor` 比旧版 `setSize(display.bounds)` 更贴近系统原生全屏，多显示器语义更清晰、更稳。

## 备选方案与取舍

| 方案 | 结论 |
| --- | --- |
| 保持 Electron | 迁移成本最低，但违背「替换 Electron」的目标。 |
| Tauri v1 | 能力弱于 v2（如 `setFullscreenOnMonitor`、`setFocusable` 在 v2 更完整），且 v1 已进入维护期。 |
| 纯 Web / PWA | 无法稳定实现置顶、全屏遮挡、托盘。 |
| Flutter / Rust 原生 | 前后端全重写，旧 UI 资产不可复用，成本高。 |

## 影响与风险

- **平台差异**：
  - macOS：官方注明 `setFocusable(false)` 在窗口已聚焦时无法取消聚焦，需在 `show()` 前调用。
  - Linux/Wayland：置顶与跨工作区受窗口管理器/合成器限制，部分 WM 下 `alwaysOnTop` / `visibleOnAllWorkspaces` 可能不生效；GNOME 托盘需额外扩展（旧版已有同样限制）。
- 旧 Electron 主进程逻辑（`breaks.ts` 调度、`store.ts` 持久化、`tray.ts`、自启动）需用 Rust 重写，工作量集中在后端。
- 本决策保留的是**软遮挡**语义（与旧版一致）；若未来要「硬锁定」（独占键盘鼠标、禁止 Alt+Tab、kiosk 级），需另做 OS 级处理，暂不纳入本期。

## 后续

- 在首个休息窗口 spec（`docs/specs/0002-*.md`）中把上述窗口行为固化为验收标准，并引用本 ADR。
- 后端模块拆分见 `docs/plans/`（M4 阶段）。
