# 架构

## 现状（旧版 `breaktimer-app`）

> 参考旧仓库的 `breaktimer-app/CLAUDE.md`。

- Electron 桌面应用，常驻系统托盘，支持全屏休息覆盖层与通知。
- 主进程 `app/main/`：休息调度、IPC、设置持久化、托盘、窗口、通知、自启动。
- 渲染进程 `app/renderer/`：React 19 + Tailwind CSS + shadcn/ui。
- 技术栈：Electron 43、React 19、TypeScript 5.x、Vite（渲染进程）+ Webpack（主进程）。

## 目标架构（新版 `app/`）

> 当前里程碑仅以 Windows 为验收与发布平台。以下保留 macOS/Linux 的分支隔离与兼容说明，
> 但跨平台差异不属于当前完成条件。

三层结构：

1. **前端 SPA（渲染层）**：React + TypeScript + Tailwind CSS + shadcn/ui。
   - 复用旧 `app/renderer/` 的 UI 资产（设置页、休息窗口、声音、进度组件等）。
   - 通过 Tauri `invoke()` 调用后端 command，不再直接接触 Electron `ipcRenderer`。
2. **Tauri core（Rust 后端）**：
   - **休息调度器**：复刻旧 `breaks.ts`（定时、工作时段、闲置重置、休眠恢复）。
   - **窗口管理**：每个显示器一个 break window；提示条不可聚焦，激活 Popup 休息后使用铺满显示器
     边界的可聚焦输入阻断层，`showBackdrop` 只控制视觉遮罩（ADR-0004、ADR-0007）。
   - **托盘**：菜单、倒计时文本、立即休息、开关休息。
   - **设置持久化**：复刻旧 `store.ts`。
   - **系统集成**：空闲检测、系统通知、自启动、声音播放。
3. **系统层**：系统 WebView（WebView2 / WKWebView / WebKitGTK）+ OS API（显示器枚举、全屏、置顶、托盘、通知、自启动）。

### 多语言资源流（SPEC-0014，ADR-0012）

- `app/locales/<locale>.json` 同时供 React 与 Rust 使用；每种语言一个自描述 JSON 文件，
  不维护前后端两套翻译。
- React 通过 `import.meta.glob` 自动发现资源，由轻量 `I18nProvider` / `useI18n()` 提供
  `t()`、语言列表和切换后的重新渲染。
- Rust 通过 `include_dir` 嵌入同一目录，负责系统语言解析、有效 locale 计算、托盘 /
  About / 系统通知文案，并向设置页提供当前有效 locale。
- 设置中的 `language=null` 表示跟随系统；保存后广播 `locale-changed`，WebView 更新界面，
  托盘刷新最终文案，系统通知从下一次触发开始使用新语言。
- 资源使用 `{name}` 占位符和 `one` / `other` 简单复数，缺失 key 回退 `en-US`；完整 ICU
  不在当前架构内（ADR-0012）。

## 代码地图

> 改代码前先在这里定位文件，不要每次重新扫描 `app/`。新增或迁移模块时同步补一行。
> 「做什么、验收标准」看对应 SPEC，不写在本表。

### 前端（`app/src/`）

| 关注点 | 主要文件 | 相关文档 |
| --- | --- | --- |
| 入口与窗口分流（`break-*` → 休息窗，其余 → 设置窗） | `main.tsx`、`App.tsx` | SPEC-0010 |
| 休息窗 UI 与倒计时 | `components/break/break-window.tsx`、`utils.ts` | SPEC-0002 |
| 设置窗与四个页签 | `components/settings/settings-window.tsx` | SPEC-0010 |
| 设置卡片（时长 / 时段 / 跳过 / 推迟 / 提示音 / 遮罩 / 主题 / 自启 / 语言 / 更新 / 统计） | `components/settings/*-card.tsx`、`durations.ts`、`working-hours.ts` | SPEC-0004 · 0007 · 0008 · 0009 · 0010 · 0014 · 0017 · 0018 |
| 表单基础组件（shadcn/ui） | `components/ui/` | — |
| IPC 封装与事件订阅 | `lib/ipc.ts` | SPEC-0010 |
| 翻译层 `t()` / `I18nProvider` | `lib/i18n.tsx` | SPEC-0014 · ADR-0012 |
| 前端异常上报桥接 | `lib/diagnostics.ts` | SPEC-0019 |
| 前后端共享类型 | `types/*.ts` | — |
| 翻译资源（React 与 Rust 共用） | `app/locales/*.json` | SPEC-0014 · ADR-0012 |

### 后端（`app/src-tauri/src/`）

| 关注点 | 主要文件 | 相关文档 |
| --- | --- | --- |
| 入口、插件与状态装配 | `lib.rs`、`main.rs` | — |
| Tauri command 面 | `commands.rs` | — |
| 应用目录与便携版判定 | `app_paths.rs` | SPEC-0012 |
| 设置模型、持久化与副作用 | `state/settings.rs`、`state/store.rs`、`state/migrations.rs`、`state/settings_effects.rs` | SPEC-0010 |
| 休息调度器（状态机） | `breaks/mod.rs` | SPEC-0003 · 0004 · 0005 |
| 休息编排（窗口 / 声音 / 广播） | `flow.rs` | SPEC-0002 · 0008 |
| 系统空闲与锁屏 | `system_state.rs` | ADR-0005 |
| 覆盖窗与显示器枚举 | `windows/mod.rs` | SPEC-0002 · ADR-0004 · ADR-0007 |
| 托盘菜单与标题 | `tray/mod.rs` | SPEC-0006 · ADR-0006 · ADR-0010 |
| 系统通知 | `notifications/mod.rs` | SPEC-0008 |
| 声音播放 | `sounds/mod.rs` | SPEC-0009 · ADR-0003 |
| 自启动注册 | `autostart/mod.rs` | SPEC-0007 |
| 后端翻译与系统语言解析 | `i18n/mod.rs` | SPEC-0014 · ADR-0012 |
| 更新检查 | `updates/mod.rs` | SPEC-0017 · ADR-0018 |
| 装机统计上报 | `telemetry/mod.rs` | SPEC-0018 · ADR-0019 · ADR-0023 |
| 诊断日志 | `diagnostics.rs` | SPEC-0019 |
| 错误类型 | `error.rs` | — |

### 仓库其他位置

| 关注点 | 主要文件 | 相关文档 |
| --- | --- | --- |
| 打包、窗口与图标配置 | `app/src-tauri/tauri.conf.json` | SPEC-0011 · SPEC-0013 |
| 便携 ZIP 打包 | `app/scripts/package-portable.ps1` | SPEC-0012 |
| 发布流水线与版本脚本 | `.github/workflows/release.yml`、`app/scripts/release*.ps1`、`app/scripts/release-version.mjs` | SPEC-0015 · ADR-0013 |
| 验证门禁脚本 | `app/scripts/verify.ps1` | `AGENTS.md` |
| 装机统计端点（EdgeOne Edge Functions + KV HLL） | `server/metrics/` | SPEC-0018 · ADR-0019 · ADR-0023 |
| 宣传页（纯静态，中英双语） | `site/`、`site/scripts/`、`.github/workflows/pages.yml` | SPEC-0016 · ADR-0024 |

### 宣传页（`site/`）

- `site/` 独立于 `app/` 与 `docs/`：没有构建器、没有依赖树，不参与 `pnpm verify` 与
  Cargo 门禁；发布产物只有该目录的副本。
- `index.html`（简体中文，默认）与 `en/index.html` 共享 `assets/styles.css`，语言切换是普通链接。
- `.github/workflows/pages.yml` 先跑 `site/scripts/check-static.mjs`（禁止 `<script>`、
  远程资源与坏链）与解析器单测，再复制 `site/` 为 `_site`，用
  `site/scripts/resolve-downloads.mjs` 读取最新 Release 正文的 `breaktimer-downloads`
  标记（百度 / 夸克网盘，与 SPEC-0017 同源），把链接与提取码写进副本，最后部署到
  GitHub Pages（ADR-0024、ADR-0025）。
- 站点基址固定为 `https://githunhunhub.github.io/breaktimer-new/`；canonical、`hreflang`、
  OG、`sitemap.xml`、`robots.txt` 与 `404.html` 都依赖该基址，更换域名时必须同步修改。

## 关键实现约定（改动前需了解的不变量）

- 调度器状态机：`Idle / Working / OnBreak / Postponed`，1 秒 tick；长 tick 或锁屏 / 休眠恢复
  不补发过期休息。
- 窗口：提示条不可聚焦；Popup 激活后的覆盖层铺满显示器 bounds、可聚焦并主动获焦，
  `showBackdrop` 只影响渲染层视觉（ADR-0004、ADR-0007）。
- `flow` 是窗口、声音与 `break-status` 广播的唯一编排点，多窗口不得各自产生副作用。
- 设置保存：先持久化，再由纯函数计算副作用——自启动变更、从禁用切回启用时重置计时、
  仅在休息频率或启停状态变化时重启调度器；改其他字段保留当前倒计时。
- 托盘根菜单只绑定一次；倒计时与禁用时长走稳定菜单项原地改文本，可用操作变化时才调整
  动态项显隐（ADR-0010）。临时禁用写入 `disableEndTime`，由 1 秒 tick 到期自动恢复。
- 数据目录：安装版 `%APPDATA%\com.githunhunhub.breaktimernew`，便携版 `<程序目录>\data\`；
  设置、日志与 `installId` 都在其中（SPEC-0012）。
- 开发构建（`debug_assertions`）跳过真实自启动注册、更新自动检查与装机统计上报。

## 落地状态（摘要）

- 里程碑 M0-M5 已完成，Windows 是唯一验收与发布平台；未完成项见 `docs/roadmap.md`。
- 各需求的实现与验收记录写在自己的 SPEC 里，本文件不再逐条复述。
- 发布链路：`develop` 日常开发 → 推送 `vX.Y.Z` Tag → `.github/workflows/release.yml`
  生成 NSIS 安装包、便携 ZIP 与 `SHA256SUMS.txt`（SPEC-0015 · ADR-0013、ADR-0017）。

## 与旧架构的关键差异

| 维度          | 旧版（Electron）                                | 新版（Tauri v2）                                                   |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| 后端语言      | Node.js/TypeScript（主进程）                    | Rust                                                               |
| 运行时        | 捆绑 Chromium + Node                            | 系统 WebView + 轻量 Rust 运行时                                    |
| IPC           | `ipcMain` / `ipcRenderer`                       | `#[tauri::command]` + `invoke`                                     |
| 多显示器遮挡  | 手工 `setSize(display.bounds)` 软遮挡           | 手工铺满显示器 bounds 的应用层输入阻断覆盖层（ADR-0004、ADR-0007） |
| 焦点策略      | 休息窗始终 `focusable:false` + `showInactive()` | 提示条不可聚焦；激活 Popup 休息可聚焦并主动获得焦点                |
| 构建          | Vite（渲染）+ Webpack（主进程）                 | Vite（前端）+ `cargo build`（Rust）                                |
| 打包体积/内存 | 较大                                            | 明显更小                                                           |
