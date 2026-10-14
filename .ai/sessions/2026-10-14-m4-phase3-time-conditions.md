# 2026-10-14 M4 阶段 3：时间与系统状态条件

- 关联：SPEC-0003、SPEC-0004、SPEC-0005、PLAN-0002 阶段 3、ADR-0005
- 状态：实现完成，自动化验证通过；Windows 真实锁屏人工验收待做

## 目标

把调度器从固定倒计时扩展为消费真实工作时段与系统活动状态，覆盖空闲重置、可选通知、长 tick 间隔和锁屏恢复。

## 决策

- `BreakScheduler` 保持纯状态机；每次 tick 接收 `SchedulerContext`，包含当前时间、是否在工作时段和系统活动状态。
- 系统查询放在 `SystemStateProvider` 后；空闲时长使用 `system-idle-time`，Windows 使用 `OpenInputDesktop` 探测锁屏（ADR-0005）。
- macOS/Linux 暂不实现轻量通用锁屏查询，按空闲/不可用语义降级；完整查询留待跨平台验收。
- 长 tick 间隔或锁屏期间不补发过期休息，恢复后从当前时刻重新倒计时。

## 实现

- Rust：新增 `system_state`；扩展 `BreakScheduler` 的工作时段、空闲、锁屏和长间隔处理；`AppState` 注入系统状态 provider 并把本地时间转换为工作日/当天分钟数。
- 通知：空闲重置可发 `Break automatically detected` / `Away for HH:MM:SS` 系统通知。
- 前端：设置窗口新增「Working Hours」和「Smart Breaks」分组，支持逐日开关、多时间段增删与时间编辑、空闲时长分钟/秒和通知开关。
- 设置项：接入现有 `workingHours*`、`idleResetEnabled`、`idleResetLengthSeconds`、`idleResetNotification` 字段。

## 验证

- Rust：`cargo test --all-targets`、`cargo check --locked --all-targets` 通过；覆盖工作时段边界、进入工作时段重置、空闲阈值重置、禁用空闲暂停、通知开/关、长 tick 间隔和长锁屏恢复。
- 前端：`pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm format:check`、`pnpm build` 全部通过；设置窗口覆盖加载、保存、增删时间段和禁用态。

## 已知边界

- Windows 锁屏探测依赖交互桌面句柄；macOS/Linux 暂无同等轻量查询。
- 真实系统锁屏/休眠的人工验收尚未执行；状态机与 provider 已通过注入上下文自动化验证。
- 托盘立即休息与状态展示仍属 PLAN-0002 阶段 4。

## 后续

1. 进入阶段 4：托盘、自启动与通知模式。
2. 跨平台验收时验证 macOS/Linux 空闲与锁屏降级行为。

## 收尾记录

- 2026-10-14：阶段 3 提交 `82f2db3`，以 `--no-ff` 合入 `master`（merge `541158c`）并推送 `origin/master`。
- 合并结果上重新验证：Rust 63 tests、locked all-target check 和前端 test/lint/typecheck/format/build 全部通过。
