# 02 · Tauri 桌面技术栈与窗口能力

> 状态：已整理
> 关联：`docs/decisions/0002-technology-stack.md`、`docs/decisions/0007-popup-break-input-blocking-overlay.md`

## 是什么

Tauri 是一个用 **Rust 写后端、用系统 WebView 渲染前端** 的桌面应用框架。它把「业务逻辑」放在 Rust 进程里，把「界面」交给前端框架（React/Vue/Svelte…），两者通过命令（command/IPC）通信。

关键对比 Electron：

| 维度 | Electron | Tauri v2 |
| --- | --- | --- |
| 后端语言 | Node.js / TypeScript | Rust |
| 渲染 | 自带 Chromium | 系统 WebView（Windows: WebView2，macOS: WKWebView，Linux: WebKitGTK） |
| 体积 / 内存 | 大（捆绑 Chromium + Node） | 小（不捆绑浏览器） |
| 前后端通信 | `ipcMain` / `ipcRenderer` | `#[tauri::command]` + 前端 `invoke()` |

## 为什么本项目选它

1. 本次重构目标之一就是**替换 Electron**，Tauri 是最主流的「更轻、更现代」的替代路径。
2. 前端可以**复用**旧项目 React + TypeScript + Tailwind + shadcn/ui 资产，迁移成本低。
3. 休息调度、托盘、系统集成这类后台逻辑适合用 Rust 表达，且是 Tauri 官方路径。

## 怎么用：本项目最关键的窗口能力

旧版「强制全屏阻塞」其实是一套窗口组合拳，Tauri v2 有逐一对应的原生 API：

| 旧版 Electron 语义 | Tauri v2 对应 API | 说明 |
| --- | --- | --- |
| 无边框 | `decorations: false` / `setDecorations(false)` | 去掉系统标题栏 |
| 透明 | `transparent: true` | 允许透明背景 |
| 置顶 | `setAlwaysOnTop(true)` | 保持在其它窗口之上 |
| 跨工作区/桌面可见 | `setVisibleOnAllWorkspaces(true)` | 切换虚拟桌面也可见 |
| 不进任务栏 | `setSkipTaskbar(true)` | 隐藏任务栏图标 |
| 控制是否可聚焦 | `setFocusable(true/false)` | 提示条设为 `false`；激活 Popup 休息设为 `true`，macOS 需在 `show()` 前设置 |
| 主动聚焦 | `setFocus()` | 激活休息至少让一个覆盖窗获得键盘焦点 |
| 多显示器铺满 | `setSize(bounds)` + `setPosition(bounds)` | 不切原生全屏，避免 macOS Space 切换并覆盖任务栏区域 |
| 显示 | `show()` | 焦点策略应在 `show()` 前设置，再按阶段决定是否调用 `setFocus()` |

要点：旧版 Electron 是用 `window.setSize(display.bounds)` 手工把窗口「撑满」到显示器尺寸；
本项目继续采用显示器 bounds 几何，而不使用 `setFullscreenOnMonitor`。原因是原生全屏会改变 macOS
Space，且不方便区分「视觉遮罩」和「输入阻断」两个独立概念。

## 一个需要警惕的认知点：软遮挡 vs 硬锁定

阶段 2 读旧源码后确认，旧版 BreakTimer 的「全屏阻塞」是 **软遮挡（soft overlay）**：

- 全屏覆盖层挡住视线、限制分心；
- 但**不抢焦点、不锁键盘鼠标、不阻止 Alt+Tab / 切任务**；
- 用户可以随时点「结束休息」或「推迟」。

阶段 4 人工验收后，项目作者确认 Popup 休息需要比旧版更强，但仍不是 kiosk：

- 提示条不可聚焦，不打断当前应用；
- 激活 Popup 休息时，每个显示器的窗口覆盖完整 bounds，窗口可聚焦，底层应用、任务栏和托盘不能点击；
- 应用内只通过 `Cancel Break` 退出；
- 不拦截 Alt+Tab、Windows 键或任务管理器，仍不是不可恢复的硬锁定。

关键认知是：**“视觉遮罩是否显示”与“窗口是否阻断输入”必须分开建模**。`showBackdrop=false`
只表示视觉上透明，不能把窗口缩成居中小窗，否则底层界面会重新暴露并可操作（见 ADR-0007）。

> AI 编程启示：接到「强制全屏阻塞」这类需求时，先**回到源码验证真实行为**，而不是按字面假设。需求文档里的一句话，可能对应实现里的三四个窗口标志位组合。把「真实行为」写进 spec，比把「口头描述」写进 spec 更可靠。
