# 2026-10-14 M4 阶段 2：调度 + 休息窗 + 声音

- 关联：SPEC-0002、SPEC-0003、SPEC-0009、PLAN-0002 阶段 2、ADR-0003、ADR-0004
- 状态：实现完成，自动化验证通过，Windows 人工验收通过；macOS/Linux 平台验收待做

## 目标

跑通最小闭环：定时触发提示 → 进入休息窗 → 支持开始/推迟/跳过/结束 → 重新调度，并接入开始/结束声音。

## 决策

- 休息遮挡不使用原生全屏，改为窗口铺满显示器物理 bounds，保持 `focusable:false` 的软遮挡语义（ADR-0004）。
- 声音由 Rust `rodio` 播放嵌入 WAV，避免 WebView 自动播放策略和隐藏窗口生命周期（ADR-0003）。
- 调度器保持纯状态机，`flow` 负责把状态转换编排为窗口、声音和 `break-status` 广播。
- 多窗口命令使用带锁的状态转换，只有第一次开始/结束转换产生副作用，避免重复播放和重复关窗。

## 实现

- Rust：新增/扩展 `breaks`、`flow`、`windows`、`sounds`、`state` 和 commands；1 秒 tick 在主线程调度。
- 窗口：每个显示器一个无边框、透明、置顶、跨工作区、不抢焦点窗口；提示条按按钮数量计算宽度，休息阶段按 `showBackdrop` 选择铺满或居中 500×300。
- 前端：新增 `BreakWindow`、休息状态类型、IPC 封装和提示/倒计时/进度交互。
- 资源：从只读旧仓库复制 5 种声音的 start/end WAV 到 `app/src-tauri/sounds/`。

## 验证

- Rust：`cargo fmt --all -- --check`、`cargo check --locked --all-targets`、`cargo test --all-targets` 全部通过，50 tests passed。
- 前端：`pnpm test`（8 tests）、`pnpm lint`、`pnpm typecheck`、`pnpm format:check`、`pnpm build` 全部通过。
- 自动化覆盖：状态机转换、完成判定、推迟/跳过、窗口几何、提示条宽度、声音资源映射、休息窗提示与进度交互。

## 已知边界

- Windows 多显示器、焦点保持、跨工作区、真实音频和结束流程已由用户人工验收通过。
- 未验证 `showBackdrop=false`、推迟/跳过按钮、混合 DPI，以及 macOS/Linux 平台限制。
- 工作时段、闲置重置、休眠/锁屏恢复属于阶段 3；通知模式、托盘动作和剩余设置 UI 属于阶段 4。

## 后续

1. 进入 PLAN-0002 阶段 3：工作时段、闲置重置与休眠/锁屏恢复。
2. 跨平台验收时补记 SPEC-0002 的 macOS/Linux 平台限制，并验证剩余验收项。

## 收尾记录

- 2026-10-14：阶段 2 提交 `17c42d7`，以 `--no-ff` 合入 `master`（merge `e9b4fb3`）并推送 `origin/master`。
- 2026-10-14：Windows 人工验收五项全部通过；开发版已停止，用户原设置已从备份恢复。
