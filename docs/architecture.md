# 架构

## 现状（旧版 `breaktimer-app`）

> 参考旧仓库的 `breaktimer-app/CLAUDE.md`。

- Electron 桌面应用，常驻系统托盘，支持全屏休息覆盖层与通知。
- 主进程 `app/main/`：休息调度、IPC、设置持久化、托盘、窗口、通知、自启动。
- 渲染进程 `app/renderer/`：React 19 + Tailwind CSS + shadcn/ui。
- 技术栈：Electron 43、React 19、TypeScript 5.x、Vite（渲染进程）+ Webpack（主进程）。

## 目标架构（新版 `app/`）

三层结构：

1. **前端 SPA（渲染层）**：React + TypeScript + Tailwind CSS + shadcn/ui。
   - 复用旧 `app/renderer/` 的 UI 资产（设置页、休息窗口、声音、进度组件等）。
   - 通过 Tauri `invoke()` 调用后端 command，不再直接接触 Electron `ipcRenderer`。
2. **Tauri core（Rust 后端）**：
   - **休息调度器**：复刻旧 `breaks.ts`（定时、工作时段、闲置重置、休眠恢复）。
   - **窗口管理**：每个显示器一个 break window；休息阶段切换全屏遮挡 / 居中小窗。
   - **托盘**：菜单、倒计时文本、立即休息、开关休息。
   - **设置持久化**：复刻旧 `store.ts`。
   - **系统集成**：空闲检测、系统通知、自启动、声音播放。
3. **系统层**：系统 WebView（WebView2 / WKWebView / WebKitGTK）+ OS API（显示器枚举、全屏、置顶、托盘、通知、自启动）。

## 当前落地状态（M4 阶段 1）

- `app/` 已是可运行的 Tauri v2 工程：Vite + React + TypeScript 前端，Rust 2024 后端。
- 后端已建立 `state`、`breaks`、`windows`、`tray`、`notifications`、`sounds`、`autostart` 模块边界；除设置与 M3 托盘外，其余模块仍是 M4 接入点。
- IPC 已打通并集中封装：`greet`、`get_settings`、`set_settings`、`get_app_info`。
- 设置后端已支持默认值合并、旧版本迁移、JSON 持久化与应用状态字段；设置窗口已实现 draft 编辑和点击 Save 提交，当前覆盖「通用」分组。
- 保存设置会先持久化，再应用纯函数计算出的副作用：自启动变化、从禁用切到启用时重置计时，以及调度器重启；开发构建跳过真实自启动注册。
- `BreakScheduler` 已具备阶段、上次完成休息时间、下次休息时间和重启/重置接口；完整 1 秒 tick 与条件判断留待 M4 阶段 2/3。
- notification、autostart、single-instance 插件和 tray/capability 已在启动链路中装配；单实例行为已完成回归验证。

## 与旧架构的关键差异

| 维度 | 旧版（Electron） | 新版（Tauri v2） |
| --- | --- | --- |
| 后端语言 | Node.js/TypeScript（主进程） | Rust |
| 运行时 | 捆绑 Chromium + Node | 系统 WebView + 轻量 Rust 运行时 |
| IPC | `ipcMain` / `ipcRenderer` | `#[tauri::command]` + `invoke` |
| 多显示器全屏 | 手工 `setSize(display.bounds)` | `setFullscreenOnMonitor`（原生） |
| 非焦点窗口 | `focusable:false` + `showInactive()` | `setFocusable(false)` + 控制 `show()` 顺序 |
| 构建 | Vite（渲染）+ Webpack（主进程） | Vite（前端）+ `cargo build`（Rust） |
| 打包体积/内存 | 较大 | 明显更小 |
