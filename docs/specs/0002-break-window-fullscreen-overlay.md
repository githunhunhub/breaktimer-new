# SPEC-0002：Popup 休息窗全屏输入阻断（保留可选视觉遮罩）

- 状态：done
- 实现状态：阶段 2 基础实现完成；2026-10-21 A8/A9/A14 Windows 专项人工复验通过；
  2026-10-22 `showBackdrop=false`、推迟/跳过与混合 DPI 专项人工验收通过；
  当前 Windows 范围内验收完成；同日移除独立的 `Start your break when ready...`
  阶段，改为进入休息前直接显示单段 60 秒倒计时，并通过自动验证与用户人工验收
- 日期：2026-10-13
- 关联：ADR-0002 · ADR-0004 · ADR-0007 · 旧实现 `breaktimer-app/app/main/lib/windows.ts`、`ipc.ts`、`breaks.ts` 与 `renderer/components/break.tsx`

## 背景 / 问题

旧版 BreakTimer 的 Popup 模式会在每个显示器上弹出一个休息窗口；休息阶段若开启「Backdrop」，
会用无边框、透明、置顶的窗口铺满该显示器，用半透明背景限制分心。这是产品核心体验，重构后不能丢。

阶段 2 最初复刻了旧版的 **soft overlay（软遮挡）**：窗口不抢焦点，底层应用、任务栏和托盘仍可操作。
M4 阶段 4 人工验收确认，Popup 模式需要提供应用层输入阻断：休息开始时每个显示器被完整覆盖，
底层应用、任务栏与托盘不能接收鼠标输入；应用内只保留 `Cancel Break` 退出路径。该取舍见 ADR-0007。

## 需求（做什么）

1. 休息触发（Popup 模式）时，在**每个显示器**上各显示一个休息窗口。
2. 窗口为无边框、透明、置顶、跨工作区可见、不进任务栏；窗口位置与尺寸始终等于对应显示器的完整 bounds。
3. 休息阶段：
   - 每个窗口覆盖显示器完整区域，包括 Windows 任务栏和通知区域/托盘位置；
   - 所有休息窗都处于置顶输入阻断层，至少一个休息窗获得键盘焦点；
   - 底层应用、任务栏和托盘不能通过鼠标点击绕过休息窗。
4. `showBackdrop` 只控制视觉呈现，不控制窗口几何：
   - `showBackdrop=true`：按 `backdropOpacity` 显示半透明遮罩；
   - `showBackdrop=false`：窗口仍铺满显示器并阻断输入，但视觉上只显示居中休息卡。
5. 窗口内容包含休息标题、文案、进度/倒计时，以及 `Cancel Break` 按钮；激活休息期间该按钮始终使用
   `Cancel Break` 文案。
6. 休息前提示条仍为不可聚焦窗口，不打断用户当前应用；提示条直接显示单段 60 秒
   `Break starting in Ns...` 倒计时，不再先显示 `Start your break when ready...` 阶段；
   提示条中的「开始 / 推迟 / 跳过」行为保持不变。
7. 手动 `Cancel Break` 与倒计时自然结束走同一条结束流程：关闭所有显示器的休息窗，交由调度层记录并安排下一次休息。

## 验收标准（可测）

- [x] 休息前提示条不可聚焦，不打断用户当前应用。
- [x] 激活 Popup 休息后，每个显示器都被休息窗完整覆盖，包括任务栏和托盘区域。
- [x] 激活 Popup 休息后，底层应用、任务栏和托盘都不能接收鼠标点击。
- [x] `showBackdrop=true` 时显示半透明遮罩，窗口几何仍为完整显示器 bounds。
- [x] `showBackdrop=false` 时休息卡在显示器中居中，窗口仍覆盖完整显示器并阻断输入。
- [x] 激活休息期间按钮始终显示 `Cancel Break`，点击后关闭所有显示器的休息窗并进入结束流程。
- [x] 应用内除 `Cancel Break` 外没有可绕过休息的退出入口；Alt+Tab、Windows 键、任务管理器不属于阻断承诺。
- [x] 启用推迟时，提示条中的「Snooze」按推迟时长重新调度；启用跳过时，「Skip」按正常频率重新调度。
- [x] 进入休息前立即显示单段 60 秒 `Break starting in Ns...` 倒计时，不出现
  `Start your break when ready...` 独立阶段。
- [x] 多显示器下，主窗口发起的结束/进度同步能广播到其它显示器窗口（各窗进度一致）。
- [x] 当前里程碑只验收 Windows；macOS/Linux 的平台限制与运行验收后续需要时单独立项，不将 Windows 结果外推为跨平台通过。

## 非目标 / 边界

- 不实现 **kiosk 级硬锁定**：不拦截 Alt+Tab、Windows 键、任务管理器，不独占系统级键盘鼠标（见 ADR-0002、ADR-0007）。
- 本 spec 不覆盖：休息调度算法、工作时段、闲置重置、系统托盘、自启动、`Notification` 通知模式、声音（留待后续 spec）。
- 不覆盖「本次休息是否计为完成」（≥ 一半时长）的统计逻辑，该逻辑属于调度/统计 spec；本 spec 只保证窗口正确展示与结束流转。
- 暂不做多语言本地化。

## 设计要点（可选）

- 每显示器一个 `WebviewWindow`，组合 `decorations:false` + `transparent:true` + `alwaysOnTop` + `skipTaskbar` + `visibleOnAllWorkspaces`。
- 提示条展示时保持 `setFocusable(false)`；激活 Popup 休息时对覆盖窗调用 `setFocusable(true)`，显示后至少聚焦一个窗口。
- 激活休息的几何始终使用「窗口位置与尺寸 = 显示器 bounds」（ADR-0004），不调用原生全屏；`showBackdrop` 仅传给渲染层控制视觉。
- 后端广播 `break-status`，并统一关闭所有休息窗（对应旧版 `sendIpc(BreakEnd)` 的语义）。
- 前端复用旧 `break.tsx` 及其子组件，只把 `ipcRenderer` 调用替换为 Tauri `invoke`。

## 实现计划

- [x] 初始化 Tauri v2 工程骨架（`app/`），前端接入 React + TypeScript + Tailwind + shadcn/ui。
- [x] Rust 后端实现休息窗口管理：按显示器枚举创建窗口、铺满/居中、关闭、事件广播。
- [x] 前端复刻 Break 窗口组件与「结束/推迟/跳过」交互。
- [x] 阶段 2 联调多显示器、基础结束流程与声音。
- [x] 2026-10-19 根据 A8/A9 反馈记录可聚焦输入阻断覆盖层决策（ADR-0007）。
- [x] 用窗口展示策略与几何单测锁定新行为，并实现提示条/激活休息的分阶段焦点策略和完整 bounds。
- [x] 在 Windows 双显示器上复验完整覆盖、任务栏/托盘输入阻断、`Cancel Break` 退出和托盘恢复。
- [x] 补做 `showBackdrop=false`、推迟/跳过与混合 DPI 专项验收；macOS/Linux 移出当前范围。
- [x] 移除前端 grace/countdown 双阶段与后端 120 秒总时长，改为单段 60 秒提示并补回归测试。

## 验收记录

- 2026-10-14：Rust 单元测试覆盖窗口几何、提示条宽度、休息结束/推迟/跳过状态流转；前端测试覆盖提示条、倒计时和休息卡交互。
- 2026-10-14：`cargo fmt --all -- --check`、`cargo check --locked --all-targets`、`cargo test --all-targets`、`pnpm test/lint/typecheck/format:check/build` 全部通过。
- 2026-10-14：Windows 多显示器人工验收通过：多显示器窗口、焦点保持、跨工作区可见性、结束流程均符合预期。
- 2026-10-19：M4 阶段 4 人工验收确认 A8/A9 不符合新语义：激活 Popup 休息仍沿用不可聚焦软遮挡，且 `showBackdrop=false` 使用居中小窗；用户确认改为覆盖所有显示器、任务栏和托盘的输入阻断层。
- 2026-10-19：自动化验证通过：Rust 83 tests、`cargo fmt --check`、`cargo check --locked --all-targets`，以及前端 21 tests、lint/typecheck/format/build；Windows 双屏运行期检查确认两个休息窗均覆盖完整显示器 bounds，任务栏与托盘点击命中休息窗，`Cancel Break` 后恢复 explorer。
- 2026-10-21：用户确认 A8/A9/A14 Windows 专项复验通过；完整覆盖、任务栏/托盘输入阻断、
  `Cancel Break` 退出与托盘恢复均符合预期。
- 2026-10-22：用户确认 `showBackdrop=false`、推迟/跳过按钮与混合 DPI 专项人工验收通过；
  Windows 范围内验收完成，macOS/Linux 仍移出当前范围。
- 2026-10-22：前端 format/lint/typecheck/test（39 项）/build、Rust fmt/check/test（93 项）
  与 `git diff --check` 通过；Windows 双显示器运行态确认提示条立即显示
  `Break starting in Ns...`，旧 `Start your break when ready...` 不再出现；用户人工验收通过。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-13 | 创建并确认：软遮挡 + 允许手动结束 |
| 2026-10-14 | 阶段 2 实现完成；原生全屏方案改为显示器 bounds 软遮挡（ADR-0004）；自动化验证通过，人工平台验收待做 |
| 2026-10-14 | Windows 多显示器人工验收通过；跨平台限制仍待记录 |
| 2026-10-19 | 按 A8/A9 反馈调整：激活 Popup 休息改为可聚焦应用层输入阻断；所有显示器始终使用完整 bounds；`showBackdrop` 仅控制视觉；退出按钮统一为 `Cancel Break`（ADR-0007） |
| 2026-10-19 | 修复 Windows 副屏只覆盖左上区域与事件循环创建窗口死锁；自动化验证完成，待 A8/A9/A14 人工复验 |
| 2026-10-21 | A8/A9/A14 Windows 专项人工复验通过；当前里程碑范围收敛为 Windows，剩余 `showBackdrop=false`、推迟/跳过与混合 DPI 待专项验证 |
| 2026-10-22 | `showBackdrop=false`、推迟/跳过与混合 DPI 专项人工验收通过；SPEC 标记 `done` |
| 2026-10-22 | 用户试用反馈 `Start your break when ready...` 与 `Break starting in ...` 功能重复；确认改为进入休息前直接显示单段 60 秒倒计时，SPEC 回到 `in-progress` |
| 2026-10-22 | 移除 grace/countdown 双阶段与 120 秒总时长，改为单段 60 秒提示并补回归测试；运行态与用户人工验收通过，SPEC 重新标记 `done` |
