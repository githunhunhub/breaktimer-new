# ADR-0006：系统集成阶段的托盘刷新与通知生命周期

- 状态：accepted
- 日期：2026-10-15
- 关联：SPEC-0006 · SPEC-0007 · SPEC-0008

## 背景

阶段 4 需要复刻旧版的托盘动态菜单、临时禁用与 Notification 模式。旧版 Electron 的若干能力在 Tauri v2 中没有一一对应的 API：

- Electron `Tray` 可以单独修改或隐藏菜单项；Tauri/muda 在桌面端只暴露菜单项文本、启用状态与整菜单替换，不提供逐项显隐。
- Electron `Notification.close()` 可在非 macOS 上定时关闭通知；`tauri-plugin-notification` 的 `remove_active` 在 Windows/macOS 上是 no-op，只有 Linux/BSD 能关闭已显示的通知。
- 托盘临时禁用的到期时间需要跨重启保留（SPEC-0010 已规定持久化 `disableEndTime`）。

## 决策

1. **托盘菜单按状态快照重建**：`tray` 模块把菜单所需信息归一化为 `TrayMenuState` 快照（下一次休息文案、禁用剩余时长、工作时段/闲置/休息中状态、macOS 标题）。后台 1 秒 tick 与状态变更命令都会请求刷新；只有快照变化时才调用 `set_menu` 重建菜单。
2. **临时禁用到期由调度 tick 兜底**：`disableEndTime` 持久化在 store 中；托盘选择禁用时长时写入，到期后由 1 秒 tick 自动恢复 `breaksEnabled=true` 并重置计时。手动 Enable 或设置窗口重新启用会清除 `disableEndTime`。
3. **Notification 模式在 `flow` 层分流**：调度器仍然产生「休息到期」转换，`flow` 根据 `notificationType` 决定弹窗还是发系统通知；通知模式立即把这次休息记为完成并安排下一次，不创建任何遮罩窗口。
4. **非 macOS 的通知关闭交给系统**：不实现 5 秒定时强关（插件在 Windows/macOS 无此能力）。Windows 常规 toast 与 Linux 通知守护进程会在其默认时长后自动消失；macOS 由系统管理。

## 理由

- 整菜单重建是 Tauri/muda 桌面 API 下最直接、跨平台一致的实现；快照比较把重建频率限制在可见信息变化时。
- 复用既有的 1 秒调度循环处理禁用到期，不再引入第二个定时器；休眠或长 tick 后恢复也能立即生效。
- 通知模式在 `flow` 分流保持了 `BreakScheduler` 的纯状态机边界：状态机不需要知道 UI 呈现方式，测试仍可确定性地覆盖两种模式。
- 不手工拼接平台通知 API 或写降级 hack：遵循「优先 Tauri 官方插件」的既有决策，通知生命周期与系统保持一致。

## 影响

- 托盘菜单与调度状态同源，不需要在托盘模块维护第二份调度状态；代价是每秒计算一次快照（廉价，且只在变化时重建菜单）。
- SPEC-0008 的「非 macOS 约 5 秒自动关闭」改由系统通知服务默认行为保证：Windows 以系统 toast 默认时长验收，Linux 视通知守护进程而定。
- 后续若需要通知点击跳转或自定义关闭时长，需要换用更底层的平台通知实现，属 SPEC-0008 声明的非目标。
