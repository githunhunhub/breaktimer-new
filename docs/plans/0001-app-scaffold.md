# PLAN-0001：初始化 `app/` Tauri v2 工程骨架

- 状态：done
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

- [x] Rust 工具链：`rustc --version`、`cargo --version`
- [x] Node.js：`node --version`、`npm --version`（或 pnpm）
- [x] Tauri CLI：`cargo tauri --version` 或项目内 `@tauri-apps/cli`
- [x] 平台 WebView：Windows WebView2、macOS WKWebView、Linux WebKitGTK

## 任务清单

- [x] 用 Tauri v2 + React-TS 模板在 `app/` 初始化工程（或手动搭建等价结构）。
- [x] 前端接入 Tailwind CSS 与 shadcn/ui，建立目录约定（组件、页面、IPC 封装）。
- [x] 后端建立 Rust 模块骨架：`state`（设置）、`breaks`（调度）、`windows`（休息窗）、`tray`、`notifications`、`sounds`、`autostart`。
- [x] 接入上述插件，并在 `tauri.conf.json` 配置 capability / permissions。
- [x] 打通一条样例 IPC：前端 `invoke("greet")` → 后端返回，证明 IPC 链路可用。
- [x] 配置 `dev` / `build` / `test` / `lint` / `typecheck` 脚本（回填 `AGENTS.md` 常用命令）。
- [x] 将源码、配置与依赖锁文件纳入 Git 提交 `c61f425`（满足 SPEC-0001）。

## 实现结果

- 前端：Vite + React 19 + TypeScript 6 + Tailwind CSS 4 + shadcn/ui 风格组件；IPC 统一封装在 `app/src/lib/ipc.ts`。
- 后端：Tauri v2 + Rust 2024；已注册 notification、autostart、single-instance 插件，并初始化主窗口、托盘和声音模块边界。
- 设置：Rust `Settings` 模型、默认值合并、v0→v1→v2 迁移链与 JSON 持久化已落地（SPEC-0010 后端部分）。
- 命令：`greet`、`get_settings`、`set_settings`、`get_app_info`。
- 托盘：M3 仅提供 Settings 与 Quit，作为后续 SPEC-0006 功能接入点。
- 依赖：`pnpm-lock.yaml`、`Cargo.lock` 和配置均已纳入提交 `c61f425`，构建产物、依赖目录与本地状态已忽略。
- 版本控制：M3 变更集已提交为 `c61f425` 并推送到 `origin/master`。

## 验收标准

- [x] `app/` 是一个可运行的 Tauri v2 工程。
- [x] 开发命令（如 `pnpm tauri:dev`）能打开窗口并显示 React 页面。
- [x] 前端能通过 `invoke` 调用后端 command 并收到返回值。
- [x] 插件与 capability 配置正确，无明显报错。
- [x] `app/` 依赖锁文件与配置已提交，干净克隆可复现。

## 验证记录

2026-10-13 在 Windows 上完成：

- `pnpm install --frozen-lockfile`：锁文件一致。
- `pnpm lint`、`pnpm typecheck`、`pnpm format:check`、`pnpm test`、`pnpm build`：全部通过。
- `cargo fmt --all -- --check`、`cargo check --locked --all-targets`、`cargo test --all-targets`：全部通过，Rust 11 个测试通过。
- `pnpm tauri:dev`：窗口打开并渲染 React 页面。
- WebView2 调试协议验证：`greet` 返回预期文本；开关触发 `set_settings` 并写入 `settings.json`；重启后设置保留。
- 二次启动：single-instance 使新进程退出，原有进程保持运行。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-13 | 创建并确认 |
| 2026-10-13 | M3 完成：Tauri v2 工程、IPC、插件/托盘骨架、设置持久化后端与验证通过 |
