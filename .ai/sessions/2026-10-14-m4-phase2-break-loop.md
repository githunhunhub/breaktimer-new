# 2026-10-14 M4 阶段 2：调度 + 休息窗 + 声音

- 关联：SPEC-0002、SPEC-0003、SPEC-0009、PLAN-0002 阶段 2、ADR-0003、ADR-0004
- 状态：实现完成，自动化验证通过，人工平台验收待做

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

- 未执行真实多显示器、混合 DPI、焦点保持和跨工作区人工验收。
- 未在真实音频设备上人工确认声音可听性和音量变化。
- 工作时段、闲置重置、休眠/锁屏恢复属于阶段 3；通知模式、托盘动作和剩余设置 UI 属于阶段 4。

## 后续

1. 人工验收阶段 2 的多显示器/焦点/音频行为，按结果更新 SPEC-0002 和 SPEC-0009 状态。
2. 进入 PLAN-0002 阶段 3：工作时段、闲置重置与休眠/锁屏恢复。
