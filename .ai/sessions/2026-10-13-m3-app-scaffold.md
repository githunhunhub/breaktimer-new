# 2026-10-13：M3 `app/` Tauri v2 工程初始化

## 目标

按 PLAN-0001 建立可运行的 Tauri v2 工程，打通 React → Rust IPC，并接入 M3 所需的应用壳与插件。

## 已完成

- 在 `app/` 初始化 Tauri v2 + React 19 + TypeScript + Vite + Tailwind CSS 4 + shadcn/ui 风格组件工程。
- Rust 建立 `state`、`breaks`、`windows`、`tray`、`notifications`、`sounds`、`autostart` 模块边界。
- 接入 notification、autostart、single-instance 插件；配置主窗口与 capability。
- 托盘实现 M3 最小菜单：Settings 与 Quit。
- IPC 命令：`greet`、`get_settings`、`set_settings`、`get_app_info`；前端统一封装在 `app/src/lib/ipc.ts`。
- 设置后端完成 legacy 兼容模型、默认值合并、v0→v1→v2 迁移与 JSON 持久化（SPEC-0010 后端部分）。
- 排除 template-only opener 插件；源码、配置和 `pnpm-lock.yaml` / `Cargo.lock` 均可纳入 Git。
- 回填 `AGENTS.md` 常用命令，更新 PLAN-0001、roadmap、architecture、README 与 SPEC-0010 状态。

## 验证

- `pnpm install --frozen-lockfile`
- `pnpm lint` / `pnpm typecheck` / `pnpm format:check` / `pnpm test` / `pnpm build`
- `cargo fmt --all -- --check` / `cargo check --locked --all-targets` / `cargo test --all-targets`（11 个 Rust 测试通过）
- `pnpm tauri:dev` 实际打开窗口。
- 通过 WebView2 调试协议验证真实渲染进程：`greet` 返回预期文本；开关调用 `set_settings` 并写入 `settings.json`；重启后设置保留。
- 启动第二个进程后自动退出，原进程保持运行，single-instance 生效。

## 修复的问题

- ESLint flat config 误用了 react-hooks 旧式 preset，改为 `configs.flat["recommended-latest"]`。
- TypeScript 6 弃用 `baseUrl`，移除后 `paths` 仍可解析。
- 模板文件统一 Prettier 格式。
- 设置路径 flex 项增加 `min-w-0`，避免窄窗口横向溢出。

## 待续

- M4 从 PLAN-0002 阶段一（设置/生命周期地基）开始。
- 声音播放通道（前端 audio vs Rust 音频库）确定后补 ADR。
- M3 变更集已提交为 `c61f425` 并推送到 `origin/master`；`breaktimer-app/` 未修改。
