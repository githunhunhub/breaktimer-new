# 2026-10-15 M4 阶段 4：系统集成（托盘 / 自启动 / 通知模式 / 设置分组）

- 关联：SPEC-0006、SPEC-0007、SPEC-0008、SPEC-0010、PLAN-0002 阶段 4、ADR-0006
- 状态：实现与自动化验证完成，运行时冒烟通过；Windows 真实桌面人工验收待做

## 目标

补齐系统集成：托盘动态菜单与临时禁用、登录自启动、Notification 提醒模式，以及设置窗口剩余分组（Breaks / Menu Bar Text / Audio / Start at login）。

## 决策

- 托盘菜单按状态快照整体重建：Tauri/muda 只支持整菜单替换，不提供逐项显隐；1 秒 tick 与状态变更命令都请求刷新，快照未变化时跳过（ADR-0006）。
- 临时禁用到期由调度 tick 兜底：`disableEndTime` 持久化在 store，到期后 tick 恢复 `breaksEnabled=true` 并重置计时；不再引入第二个定时器。
- Notification 在 `flow` 层分流：调度器仍是纯状态机，`flow` 依据 `notificationType` 决定弹窗或发系统通知；通知模式立即完成本次休息并续排。
- 非 macOS 通知的关闭时长交给系统通知服务（插件在 Windows/macOS 无法主动关闭），SPEC-0008 的「约 5 秒关闭」按系统默认行为验收。
- 托盘刷新不在持锁期间调用托盘 API：`TrayIcon::set_menu` / `set_title` 会 marshal 到主线程并阻塞等待，而菜单事件本身就在主线程触发刷新；锁只用于快照比较与记录。实现用 `app.tray_by_id` 取回图标句柄（图标由 Tauri manager 持有），顺势去掉类型擦除的 `Box<dyn Any>` 存储。

## 实现

- 托盘：`tray` 模块新增 `TrayState` / `TraySnapshot` 纯函数快照（状态文案、禁用剩余时长、macOS 标题、Enable/Disable/Start break 显隐）；菜单含 Next break / Disabled for / Outside of working hours / Idle、Disable 子菜单（Indefinitely、30 分钟、1/2/4 小时、Rest of day）、Start break now、Settings、About、Quit；About 使用 `tauri-plugin-dialog` 的 `MessageDialogBuilder`。
- 自启动：接入 `tauri-plugin-autostart`（`app_name` 为 BreakTimer）；启动时按 `autoLaunch` 同步注册，保存设置时按副作用应用；开发构建跳过真实注册。
- 通知模式：`flow` 增加 `notify_break`（发通知 + 播放开始音 + 立即完成续排），不触碰 `windows`；`notifications` 增加 `strip_html`（`<br>` 转空格、其余标签移除）。
- 状态：`state` 增加 `expire_timed_disable`；`store.set_settings` 在 `breaksEnabled=true` 时清空 `disableEndTime`；保存设置后广播状态以刷新托盘。
- 声音：`sounds::play_preview` 与 `play_sound_preview` command，支持设置窗口试听未保存的音色与音量。
- 前端：新增 UI 原语 `select` / `textarea` / `slider`；新增设置卡片 `startup-card`、`breaks-card`、`tray-card`、`audio-card`；`settings-window` 组合为 General / Start at login / Breaks / Working Hours / Smart Breaks / Menu Bar Text / Audio。
- 文档：新增 ADR-0006；更新 `docs/architecture.md`「当前落地状态（M4 阶段 4）」、PLAN-0002、`docs/roadmap.md` 与 SPEC-0006/0007/0008/0010 及 specs 索引。

## 验证

- Rust：`cargo fmt --check`、`cargo check --locked --all-targets`、`cargo test --all-targets` 通过，83 tests（含托盘快照/标题模式、临时禁用到期、自启动开发跳过、通知正文剥离、设置副作用）。
- 前端：`pnpm lint`、`pnpm typecheck`、`pnpm format:check`、`pnpm test`（3 文件 20 tests）、`pnpm build` 全部通过。
- 运行时冒烟：`pnpm tauri:dev` 启动成功，托盘初始化与每秒刷新无错误输出（无 "tray icon is not registered" / "failed to build tray menu"），应用退出正常。
- 未覆盖（需真实桌面人工验收）：托盘图标显示与菜单交互、临时禁用到期恢复、Windows 登录自启与注册路径、系统通知不弹遮罩窗、通知关闭时长、提示音与通知同时发生、macOS 菜单栏标题。

## 已知边界

- 托盘图标沿用既有 `icons/32x32.png`，不做自定义绘制；Linux/GNOME 无托盘时沿用旧版降级思路，尚未实现。
- Notification 模式在手动「Start break now」时同样只发通知并立即续排。
- 设置窗口仍未覆盖遮罩颜色/透明度、结束/跳过/推迟开关、立即开始休息，属阶段 5。
- 非 macOS 通知的关闭时长依赖系统（Windows toast / Linux 通知守护进程），不做强制关闭。

## 后续

1. Windows 运行期人工验收阶段 4：托盘显示与菜单、禁用到期、登录自启、Notification 表现。
2. 验收通过后更新 SPEC-0006/0007/0008 状态与 specs 索引，并把 PLAN-0002 阶段 4 标记为 done。
3. 进入阶段 5：补全设置窗口剩余字段、打包发布与逐条回归。

## 收尾记录

- 2026-10-15：阶段 4 实现完成并完成自动化验证；提交与合入待用户确认。
