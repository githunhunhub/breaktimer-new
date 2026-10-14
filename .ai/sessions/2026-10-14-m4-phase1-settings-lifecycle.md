# 2026-10-14 M4 阶段 1：设置窗口与生命周期

- 关联：SPEC-0010、PLAN-0002 阶段 1、SPEC-0007
- 状态：完成

## 目标

- 让设置窗口按旧版语义工作：编辑 draft，点击 Save 后一次性持久化并生效。
- 接入设置保存副作用：自启动变化、从禁用切到启用休息时重置计时、调度重启。
- 保留阶段边界：本阶段只建立调度状态接口，不实现完整 1 秒 tick。

## 决策

- 设置保存副作用由纯函数 `SettingsEffects::between` 计算，便于测试和后续扩展。
- `set_settings` 先持久化设置，再应用自启动和调度副作用。
- 开发构建不调用真实自启动注册，避免测试环境污染用户登录项；发布构建仍按设置应用。
- 设置窗口阶段 1 只覆盖「通用」分组：`breaksEnabled`、`autoLaunch`。
- 单实例插件已经存在，本次只做回归验证，不重复实现。

## 实现

- 后端新增设置副作用模型，并扩展 `BreakScheduler` 的状态、重启与重置接口。
- `AppState` 持有调度器，保存设置后统一应用重置和重启。
- `set_settings` 串联持久化、自启动与调度副作用。
- 前端新增真实设置窗口，替换 M3 scaffold 页面，并增加保存、失败和加载测试。
- 新增 React Testing Library 与 jsdom 测试依赖。

## 验证

- Rust：`cargo test --all-targets` 24 passed；`cargo check --locked --all-targets` 通过；`cargo fmt --all` 已执行。
- 前端：`pnpm lint`、`pnpm typecheck`、`pnpm format:check`、`pnpm test`、`pnpm build` 全部通过；Vitest 为 2 个文件、5 个测试。
- 单实例：开发应用启动后 `target\debug\breaktimer.exe` 进程数保持为 1。
- 端到端：通过 WebView2 CDP 将 `breaksEnabled` 从 false 改为 true，点击 Save 后磁盘设置更新；重启后 UI 读取为 true，Save 保持禁用。
- 人工验收：2026-10-14 用户按阶段 1 步骤完成验证并确认通过。
- 清理：停止开发进程，并恢复测试前的用户设置（`breaksEnabled=false`、`autoLaunch=true`）。

## 已知边界

- 调度器尚未运行完整 tick；阶段 2 才接入触发、休息窗和声音。
- `set_settings` 先落盘再应用副作用；若自启动注册失败，command 会报错，但设置已经持久化。
- 设置窗口尚未覆盖全部 `Settings` 字段，因此 SPEC-0010 仍为 `in-progress`。

## 后续

- 进入 PLAN-0002 阶段 2：调度状态机与 1 秒循环、休息窗口、手动结束/推迟/跳过、声音通道。
