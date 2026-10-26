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

### 多语言资源流（SPEC-0014，待实现）

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

## 当前落地状态（M0-M5 已完成，Windows）

- `app/` 已是可运行的 Tauri v2 工程：Vite + React + TypeScript 前端，Rust 2024 后端。
- 后端已建立 `state`、`breaks`、`flow`、`system_state`、`windows`、`tray`、`notifications`、`sounds`、`autostart` 模块边界；阶段 2 已接入调度、休息窗与声音，阶段 3 已接入工作时段、闲置重置和休眠/锁屏恢复，阶段 4 已接入托盘、通知模式与自启动。
- IPC 已打通并集中封装：设置、应用信息、休息状态、开始/结束/推迟/跳过/立即休息，以及设置页的提示音试听命令。
- 设置后端已支持默认值合并、旧版本迁移、JSON 持久化与应用状态字段（含 `disableEndTime`）；
  设置窗口已实现四页签、跨页 draft、点击 Save 提交与 Theme 整卡实时预览，并通过 Windows
  人工验收；`System` 页签仅展示实际生效的 `Start at login`，macOS-only 的 `Menu Bar Text`
  字段与标题逻辑仍保留在持久化和后端兼容层。
- 保存设置会先持久化，再应用纯函数计算出的副作用：自启动变化、从禁用切到启用时重置计时，
  以及仅在休息频率或启停状态变化时重启调度器；修改其他字段保留当前倒计时。开发构建跳过
  真实自启动注册。
- `BreakScheduler` 已具备 `Idle / Working / OnBreak / Postponed` 状态机、1 秒 tick、单段
  60 秒休息前倒计时、完成判定、推迟/跳过/立即休息与重启/重置接口；每次 tick 通过
  `SchedulerContext` 消费工作时段与系统活动状态，长 tick/锁屏恢复不会补发过期休息。
- `system_state` 通过 `SystemStateProvider` 隔离平台查询：空闲时长使用 `system-idle-time`，Windows 用输入桌面句柄探测锁屏；macOS/Linux 兼容分支不在当前验收范围（ADR-0005）。
- `windows` 按显示器创建无边框、透明、置顶、跨工作区的覆盖窗；提示条保持不可聚焦并直接显示
  单段 60 秒倒计时，激活 Popup 休息后切换为可聚焦并覆盖完整显示器 bounds，阻断底层应用、
  任务栏和托盘输入；`showBackdrop` 只影响渲染层视觉，不再改变窗口几何（ADR-0007）。
  `flow` 统一编排窗口、声音与 `break-status` 广播，避免多窗口重复副作用。
- `sounds` 使用 Rust `rodio` 播放嵌入的 WAV 资源（ADR-0003），`SoundType=None` 静音。
- `tray` 把菜单与标题所需信息归一化为纯函数快照（状态、下次休息文案、禁用剩余时长、标题）。
  根菜单只绑定托盘一次，倒计时与禁用时长通过稳定菜单项原地改文本，只有可用操作变化时才
  原地调整动态项显隐，避免 Windows 正在显示的菜单被替换；临时禁用写入 `disableEndTime`，
  由 1 秒 tick 到期自动恢复。Windows 菜单已验收，macOS 标题兼容不在当前范围（ADR-0006、ADR-0010）。
- `flow` 按 `notificationType` 分流：`Popup` 创建遮罩窗，`Notification` 发系统通知、播放开始音并立即完成本次休息续排，不创建窗口（SPEC-0008，ADR-0006）。
- 自启动由 `autostart` 模块统一处理：启动时按设置同步注册状态，设置保存时应用变化，开发构建只记录不注册（SPEC-0007）。

### GitHub 发布流水线（SPEC-0015）

- 日常开发在 `develop` 分支完成；`master` 只接收发版合入和发布脚本生成的版本提交
  （ADR-0015）。
- 只有推送 `vMAJOR.MINOR.PATCH` Tag 才触发 `.github/workflows/release.yml`；普通 `master`
  push 不执行发布。
- `meta` Job 校验 Tag 提交属于 GitHub `master`，并确认 Tag 版本与 `package.json`、
  `tauri.conf.json`、`Cargo.toml`、`Cargo.lock` 一致。
- Windows Job 运行前后端自动化门禁，生成便携 ZIP，并从同一 release executable 生成
  NSIS；`git-cliff` 从上一发布 Tag 到当前 Tag 的 Conventional Commits 生成 Release Notes。
- 全部前置 Job 成功后才创建公开 GitHub Release，上传
  `BreakTimer-new_vX.Y.Z_x64-setup.exe`、`BreakTimer-new_vX.Y.Z_x64-portable.zip`、
  `CHANGES.md` 和 `SHA256SUMS.txt`。GitHub 是唯一发布平台；Gitee 只备份 `develop` 与
  `master`，不接收发布 Tag 或 Release（ADR-0014 · ADR-0015）。

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
