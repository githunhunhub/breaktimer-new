# ADR-0004：遮挡层用「铺满显示器边界」而非原生全屏

- 状态：已接受
- 日期：2026-10-14
- 决策者：项目作者

## 背景

ADR-0002 在选型时提出：休息阶段优先用 `setFullscreenOnMonitor(monitorPos)`
让遮挡窗在该显示器上原生全屏。进入 SPEC-0002 实现后发现两点冲突：

1. SPEC-0002 的验收标准要求「触发休息后，用户当前活跃应用仍保持焦点」，
   即**软遮挡**语义。
2. 原生全屏在 macOS 上会切换到独立的 Space（全屏空间），并可能改变焦点与
   前台应用；这与「不抢焦点」的核心体验相悖。

旧版 Electron 的实现（`breaktimer-app/app/main/lib/windows.ts`）实际是
`window.setSize(display.bounds)`：用无边框窗口**铺满显示器边界**，从不调用
系统级全屏。ADR-0002 的「原生全屏」是选型阶段的设想，未反映旧版真实行为。

## 决策

遮挡层用**铺满显示器边界的无边框窗口**实现，不使用原生全屏：

- `showBackdrop=true`：窗口位置与尺寸设为该显示器的 `position` 与 `size`。
- `showBackdrop=false`：窗口为居中的约 `500×300`。
- 两种模式都保持 `decorations:false` + `transparent:true` + `alwaysOnTop` +
  `skipTaskbar` + `visibleOnAllWorkspaces` + `focusable:false`。

本 ADR 取代 ADR-0002 中「休息阶段优先用 `setFullscreenOnMonitor`」的表述；
ADR-0002 其余结论（Tauri v2、React 前端、软遮挡语义）不变。

## 理由

- 与旧版真实行为一致，回归风险最低。
- 不触发 macOS 的全屏 Space 切换，`focusable:false` 的「不抢焦点」才真正成立。
- 窗口尺寸可控，`showBackdrop=false` 与 `true` 之间只是几何变化，逻辑统一。

## 备选方案与取舍

| 方案 | 结论 |
| --- | --- |
| 原生全屏 `setFullscreenOnMonitor` | 语义更「原生」，但 macOS 切换 Space、可能夺焦，违背软遮挡。 |
| 铺满显示器边界（采用） | 与旧版一致、不夺焦；需要自己处理多显示器坐标与 DPI。 |

## 影响与风险

- 多显示器 + 混合 DPI 下需要按显示器的物理边界计算窗口几何；已在
  `app/src-tauri/src/windows/mod.rs` 中用纯函数实现并单测覆盖。
- macOS 上透明窗口需要启用 `macos-private-api`（Cargo feature + `tauri.conf.json`）。
  它会让应用无法上架 Mac App Store；本项目按桌面端直接分发，接受该限制。
- 若未来需要「硬锁定」级全屏，可另开 ADR 评估 kiosk/原生全屏方案。
