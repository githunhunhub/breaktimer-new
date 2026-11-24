# 系统架构与技术全景

## 项目边界

- `app/`：Windows 桌面应用，Tauri v2 Rust 后端 + React SPA。
- `server/metrics/`：匿名客户端统计、公开看板与维护者报表，部署在 EdgeOne。
- `site/`：纯静态中英双语宣传页，由 GitHub Pages 发布。
- `breaktimer-app/`：旧 Electron 源码，仅作参考，禁止修改。
- `.github/`：Windows Tag 发布流水线与 Pages 发布。
- `docs/`：架构、滚动日志与 Superpowers 需求闭环；`DEVELOPMENT.md` 是完整命令来源。

## 目录与模块职责

### 桌面应用

- `app/src/main.tsx`、`App.tsx`：按窗口标签分流休息窗与设置窗。
- `app/src/components/break/`：提示条、激活休息卡、矩形/圆形进度与倒计时。
- `app/src/components/settings/`：设置页签、各设置卡片与表单。
- `app/src/lib/ipc.ts`：封装 Tauri command 与 `break-status`、`locale-changed`、`update-status` 事件。
- `app/src/lib/i18n.tsx`、`app/locales/`：React 翻译层与前后端共享翻译资源。
- `app/src-tauri/src/breaks/`：纯调度状态机，状态为 `Idle / Working / OnBreak / Postponed`，1 秒 tick。
- `app/src-tauri/src/flow.rs`：休息开始时对窗口、声音和广播做唯一编排。
- `app/src-tauri/src/windows/`：显示器枚举、提示条与输入阻断覆盖窗。
- `app/src-tauri/src/state/`：设置模型、持久化、迁移与保存副作用。
- `app/src-tauri/src/system_state.rs`：系统空闲与 Windows 锁屏探测。
- `app/src-tauri/src/{tray,notifications,sounds,autostart}/`：托盘、系统通知、Rust 声音、自启动。
- `app/src-tauri/src/{i18n,updates,telemetry,diagnostics}.rs` 或同名模块：系统语言、更新检查、匿名统计与本地日志。
- `app/scripts/`：验证、便携包、版本与发布脚本；PowerShell 文件必须保留 UTF-8 BOM。

### 统计服务与站点

- `server/metrics/edge-functions/v1/collect.js`：安装与每日心跳上报。
- `server/metrics/edge-functions/api/report.js`：维护者 JSON/CSV 报表，Bearer 令牌，`no-store`。
- `server/metrics/edge-functions/api/public-report.js`：固定 7/30/90 天公开报表。
- `server/metrics/edge-functions/_lib/`：校验、HLL、KV key、运行时适配、读取聚合与脱敏日志。
- `server/metrics/public/dashboard/`：同源公开看板静态资源。
- `site/index.html`、`site/en/index.html`：中英文静态页，共享本地样式、图标、截图与 vendored 脚本。
- `site/scripts/check-static.mjs`：禁止远程资源和坏链；`resolve-downloads.mjs` 注入 Release 网盘元数据。
- `.github/workflows/release.yml`：Tag 校验、Windows 构建、变更日志与 GitHub Release。
- `.github/workflows/pages.yml`：只发布 `site/` 副本并解析最新 Release 下载元数据。

## 核心数据流

1. 调度器每秒读取设置、工作时段与系统状态，决定是否触发一次休息。
2. `flow` 根据 Popup/Notification 模式编排窗口或通知；Popup 为每个显示器创建覆盖窗。
3. 设置保存先落盘，再计算副作用：自启动、重新启用后的计时和调度器重启；其他字段不重置当前倒计时。
4. React 通过 `invoke()` 调 Rust command，并订阅事件更新休息状态、语言和更新结果。
5. 客户端统计在启动后延迟并抖动上报；EdgeOne 将 `installId` 哈希进 HLL，报表只输出匿名聚合。
6. 发布 Tag 触发 GitHub Actions 构建 NSIS、便携 ZIP 与 `SHA256SUMS.txt`；宣传页读取隐藏 Release 元数据。

## 关键实现不变量

- 长 tick、锁屏或休眠恢复不得补发已过期休息；关闭闲置重置时忽略 `Idle`。
- 休息前提示条不可聚焦；激活 Popup 的完整显示器覆盖层可聚焦并主动获焦。
- 覆盖窗几何始终使用显示器 bounds，不使用原生全屏；`showBackdrop` 只控制视觉遮罩。
- 托盘根菜单只绑定一次；倒计时与禁用时长原地改文本，布局变化时才调整动态项。
- `flow` 是窗口、声音与状态广播的唯一副作用编排点，多窗口不得各自触发。
- 形状设置从下一次休息生效；不新增 `settings-changed` 事件，语言切换仍可即时广播。
- 安装版数据在 `%APPDATA%\com.githunhunhub.breaktimernew`；便携版在 `<程序目录>\data\`。
- 便携版只有在程序目录存在 `portable.flag` 时启用；不可写时明确报错，不回退 AppData。
- 开发构建跳过真实自启动、自动更新检查与统计上报；发布统计还要求 `BREAKTIMER_METRICS_URL`。
- 客户端协议只发送白名单字段；服务端不读取 IP/GEO，不记录请求体、令牌或明文 `installId`。

## 外部依赖与平台踩坑

- **Windows / WebView2**：目标为 Windows 10/11 x64，依赖系统 WebView2 Runtime；安装包未签名，SmartScreen 可能拦截。
- **Tauri 多显示器**：混合 DPI 下必须按显示器物理 bounds 计算窗口；原生全屏语义不符合旧版软遮挡，已弃用。
- **Windows PowerShell 5.1**：脚本含中文时必须是 UTF-8 with BOM，否则按 ANSI 解码导致提交信息乱码。
- **系统状态**：Windows 锁屏用 `OpenInputDesktop` 探测；macOS/Linux 完整锁屏查询未纳入当前支持范围。
- **GitHub 发布**：唯一远程为 GitHub；Tag 必须从 `master` 创建且已推送不可移动。发布失败使用下一个 patch 版本。
- **GitHub Pages**：站点固定在 `/breaktimer-new/` 子路径；canonical、`hreflang`、sitemap、robots 与 404 都依赖该基址。
- **Release 下载元数据**：GitHub 正文只展示变更日志；隐藏 `breaktimer-downloads` 标记供应用与宣传页读取。
- **EdgeOne 默认域名**：中国大陆访问默认项目域名需要短时预览链接，统计端点必须绑定稳定自定义 HTTPS 域名。
- **EdgeOne KV**：key 只允许字母、数字和下划线；固定 16 分片，无事务/CAS，并发读改写可能低估，最终一致约 60 秒。
- **EdgeOne list**：必须处理 `complete`、`cursor`、空页缺省 `keys` 与条目 `key` 字段；并发上限为 8。
- **公开统计性能**：只列举并读取实际存在的 `h_act_`、`h_ver_`、`h_newch_` key；Cache API 名 `public-report-v2`，仅缓存成功 200 响应 60 秒。线上 90 天首次 TTFB 仍可能约 15 秒。
- **统计隐私**：HLL 约有 1～3% 误差；平台访问日志字段、保留期、KV 区域、WAF 与域名加速区域仍需控制台核验。
- **更新检查**：只查 GitHub 最新稳定版并提示下载，不下载、不安装；开发构建跳过自动检查。
