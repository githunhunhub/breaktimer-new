# 02 · Tauri 桌面技术栈与窗口能力

> 状态：已整理
> 关联：`docs/decisions/0002-technology-stack.md`

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
| 不抢焦点 | `setFocusable(false)` | 复刻 `focusable:false`；macOS 需在 `show()` 前调用 |
| 多显示器铺满 | `setFullscreenOnMonitor(pos)` | 在某显示器上原生全屏，比旧版 `setSize(bounds)` 更稳 |
| 显示 | `show()` | 注意先 `setFocusable(false)` 再 `show()` |

要点：旧版 Electron 是用 `window.setSize(display.bounds)` 手工把窗口「撑满」到显示器尺寸；Tauri v2 的 `setFullscreenOnMonitor` 直接走系统原生全屏，多显示器语义更清晰。

## 一个需要警惕的认知点：软遮挡 vs 硬锁定

读旧源码后确认，BreakTimer 的「全屏阻塞」是 **软遮挡（soft overlay）**：

- 全屏覆盖层挡住视线、限制分心；
- 但**不抢焦点、不锁键盘鼠标、不阻止 Alt+Tab / 切任务**；
- 用户可以随时点「结束休息」或「推迟」。

这与「kiosk / 硬锁定」是两回事。硬锁定需要 OS 级手段（独占输入、拦截快捷键），跨平台很脆弱，本期不做（见 ADR-0002）。

> AI 编程启示：接到「强制全屏阻塞」这类需求时，先**回到源码验证真实行为**，而不是按字面假设。需求文档里的一句话，可能对应实现里的三四个窗口标志位组合。把「真实行为」写进 spec，比把「口头描述」写进 spec 更可靠。
