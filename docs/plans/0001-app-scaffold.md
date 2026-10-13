# PLAN-0001：初始化 `app/` Tauri v2 工程骨架

- 状态：confirmed
- 日期：2026-10-13
- 关联：ADR-0002 · SPEC-0010

## 目标

在 `app/` 下建立可运行的 Tauri v2 工程：React + TypeScript 前端、Rust 后端，打通 `invoke`/command IPC，并纳入 Git。

## 技术基线（来自 ADR-0002）

- 框架：Tauri v2
- 后端：Rust（`src-tauri/`）
- 前端：React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- IPC：`#[tauri::command]`（后端）+ `invoke()`（前端）

## 需要接入的官方插件（按 spec 映射）

| 能力 | Tauri 插件 | 对应 spec |
| --- | --- | --- |
| 系统通知 | `tauri-plugin-notification` | SPEC-0008 |
| 自启动 | `tauri-plugin-autostart` | SPEC-0007 |
| 单实例 | `tauri-plugin-single-instance` | 应用生命周期（避免重复启动） |
| 托盘 | Tauri 核心 `TrayIconBuilder`（Rust） | SPEC-0006 |
| 窗口控制 | Tauri 核心窗口 API | SPEC-0002 |

> 声音播放通道（SPEC-0009）的实现方式（前端 audio 或 Rust 音频库）待实现时确认，若构成取舍再补 ADR。

## 环境准备（先验证，缺则装）

- [ ] Rust 工具链：`rustc --version`、`cargo --version`
- [ ] Node.js：`node --version`、`npm --version`（或 pnpm）
- [ ] Tauri CLI：`cargo tauri --version` 或项目内 `@tauri-apps/cli`
- [ ] 平台 WebView：Windows WebView2、macOS WKWebView、Linux WebKitGTK

## 任务清单

- [ ] 用 Tauri v2 + React-TS 模板在 `app/` 初始化工程（或手动搭建等价结构）。
- [ ] 前端接入 Tailwind CSS 与 shadcn/ui，建立目录约定（组件、页面、IPC 封装）。
- [ ] 后端建立 Rust 模块骨架：`state`（设置）、`breaks`（调度）、`windows`（休息窗）、`tray`、`notifications`、`sounds`、`autostart`。
- [ ] 接入上述插件，并在 `tauri.conf.json` 配置 capability / permissions。
- [ ] 打通一条样例 IPC：前端 `invoke("greet")` → 后端返回，证明 IPC 链路可用。
- [ ] 配置 `dev` / `build` / `test` / `lint` / `typecheck` 脚本（回填 `AGENTS.md` 常用命令）。
- [ ] 将源码、配置与依赖锁文件纳入 Git（满足 SPEC-0001）。

## 验收标准

- [ ] `app/` 是一个可运行的 Tauri v2 工程。
- [ ] 开发命令（如 `npm run tauri dev`）能打开窗口并显示 React 页面。
- [ ] 前端能通过 `invoke` 调用后端 command 并收到返回值。
- [ ] 插件与 capability 配置正确，无明显报错。
- [ ] `app/` 依赖锁文件与配置已提交，干净克隆可复现。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-13 | 创建并确认 |
