# SPEC-0010：设置持久化与设置窗口

- 状态：done
- 实现状态：阶段 4 Windows 设置窗口与四页签已完成，C0-C7 人工验收通过；
  阶段 5 Theme、Backdrop、关闭隐藏、托盘恢复与 Quit 退出均已人工验收通过；
  2026-10-22 试用发现 Theme 卡片未实时展示所选背景色和文字色，已补齐整卡预览与
  Reset 样式并通过组件测试与便携版人工验收
- 日期：2026-10-13
- 关联：ADR-0002 · 旧实现 `breaktimer-app/app/main/lib/store.ts`、`renderer` 设置页

## 背景 / 问题

所有行为都由设置驱动。设置需要可靠持久化、跨版本迁移，并有一个窗口让用户编辑。旧版用 `electron-store` + 版本化迁移，设置页用 React 表单。

## 需求（做什么）

1. 持久化全部 `Settings` 字段，启动时加载并合并默认值。
2. 支持版本化设置迁移（旧格式 → 新格式），迁移失败不损坏已有数据。
3. 点击 Save 保存设置时同步副作用：自启动开关变化时应用；从禁用切到启用时重置「距上次休息」；必要时重启调度。
4. 持久化 `disableEndTime`（托盘临时禁用到期时间）与 `appInitialized`（是否已初始化）等应用状态。
5. 提供设置窗口，分组编辑所有可配置项（通用、调度、工作时段、闲置、通知、声音、遮罩、休息文案等）。
6. 设置窗口按原版分为 `General`、`Working Hours`、`Customization`、`System` 四个页签；默认打开
   `General`，切换页签保留未保存的 draft，顶部 Save 对全部页签共用并一次提交完整设置。
7. `General` 按原版顺序提供 `Breaks`、`Smart Breaks`、`Snooze`、`Skip`、`Advanced` 分组；
   `Breaks enabled` 开关位于 `Breaks` 分组标题右侧，不单独占用分组。
8. `Working Hours` 与原版保持紧凑的行内布局：每天首行依次显示启用开关、星期、开始时间、结束时间、
   添加按钮和复制按钮；开始/结束时间使用带原生时钟选择图标的时间控件，并保持紧凑间距；
   新增时间段才显示删除按钮，复制按钮可选择目标星期复制当前日期的时间段。
9. `Customization` 按原版提供 `Theme` 与 `Backdrop` 分组：
   - `Theme` 可编辑 `backgroundColor`、`textColor`，并提供恢复默认值
     `#16a085`、`#ffffff`、`0.7` 的 `Reset`；
   - `Theme` 卡片本身实时使用 draft 中的背景色和文字色，修改颜色控件后无需 Save 即可预览；
     卡片内标签、控件文字与 `Reset` 按钮应保持可辨识；
   - `Backdrop` 可编辑 `showBackdrop` 与 `backdropOpacity`；透明度范围为 20% 至 100%，步进 5%；
   - `showBackdrop` 仅在 `Popup break` 下可编辑；关闭遮罩后透明度滑块禁用。
10. 设置主窗口右上角 `X` 只隐藏窗口，不退出应用；应用继续在托盘运行。托盘 `Quit`
    仍执行真正退出。
11. 从托盘 `Settings...` 重新打开设置时，无论窗口已隐藏、最小化或失去焦点，都应恢复、
    显示并聚焦到设置窗口。

## 验收标准（可测）

- [x] 修改设置窗口已提供的字段后点击 Save，一次性持久化，重启应用后保留。
- [x] 未设置的字段回落到默认值（`defaultSettings`）。
- [x] 旧版本设置可按迁移链升级，且迁移失败不会破坏原数据。
- [x] 切换自启动开关后，保存时同步应用（非开发构建；见 SPEC-0007）。
- [x] 从禁用切到启用休息时，保存时重置「距上次休息」。
- [x] 设置窗口显示四个页签，默认选中 `General`；切换页签不丢失 draft，任意页签的修改可由同一次 Save 提交。
- [x] `General` 按 `Breaks`、`Smart Breaks`、`Snooze`、`Skip`、`Advanced` 顺序显示，且
  `Breaks enabled` 位于 `Breaks` 标题右侧。
- [x] `Snooze`、`Skip`、`Advanced` 的字段可加载、编辑、按依赖关系禁用，并可由同一次 Save 持久化。
- [x] 单一工作时间段不显示删除按钮；添加按钮仅显示 `+` 图标，点击后在下一行新增时间段。
- [x] 工作时间行内可使用紧凑的原生时间控件编辑开始/结束时间并保存；复制面板可将当前日期的时间段
  复制到一个或多个目标星期。
- [x] `Theme` 的颜色字段可编辑并进入同一份 draft；`Reset` 恢复默认背景色、文字颜色与遮罩透明度。
- [x] `Theme` 卡片实时预览 draft 的背景色和文字色；修改控件后立即更新，Reset 后恢复默认预览。
- [x] `Backdrop` 在 `Popup break` 下可开关并调整透明度；在 `Notification` 模式或遮罩关闭时，
  对应控件按规则禁用。
- [x] 设置窗口覆盖全部可配置字段，并在点击 Save 后一次性生效。
- [x] 点击设置窗口右上角 `X` 后应用继续运行，托盘图标与调度不受影响。
- [x] 设置窗口隐藏、最小化或失焦后，点击托盘 `Settings...` 都恢复并聚焦同一窗口。
- [x] 托盘 `Quit` 仍能真正退出应用。

## 非目标 / 边界

- 不做设置云端同步/多设备同步。
- 不做设置导入/导出文件（本期）。
- 设置窗口的具体视觉样式不在此约束，仅约束字段完整性与可编辑性。

## 设计要点（可选）

- 后端用 Rust 序列化 `Settings` 并持久化（可配 `serde` + 文件存储），前端沿用 React 表单调用 `get_settings`/`set_settings` 命令。
- 迁移采用「只增版本、顺序执行」的链式迁移，对应旧版 `migrations`。

## 实现计划

- [x] 后端实现设置读写、默认值合并与版本迁移。
- [x] 前端实现设置窗口骨架、draft 编辑与 Save 提交流程；阶段 1 仅覆盖「通用」分组（`breaksEnabled`、`autoLaunch`）。
- [x] 接入自启动、调度重启、启用休息时重置计时等保存副作用；完整 1 秒调度循环留待阶段 2。
- [x] 阶段 3 补「Working Hours」「Smart Breaks」分组。
- [x] 阶段 4 补「Start at login」「Breaks」「Menu Bar Text」「Audio（含提示音试听）」分组。
- [x] 阶段 4 将现有分组重组为 `General`、`Working Hours`、`Customization`、`System` 四个页签；阶段 5
  再向对应页签补 Theme、Backdrop 等字段。
- [x] 按 C3 人工验收反馈补 `General` 的 `Snooze`、`Skip`、`Advanced` 分组，并把 `Breaks enabled`
  合并到 `Breaks` 标题行。
- [x] 按 C3 人工验收反馈重做 `Working Hours` 行内布局、紧凑时间控件、按需显示的删除按钮，以及
  可复制到其他星期的时间段操作。
- [x] 阶段 5 补齐 `Customization` 的 `Theme`、`Backdrop` 分组与全部剩余字段。
- [x] 阶段 5 收口时注册主窗口关闭拦截，并统一托盘与单实例的设置窗口恢复逻辑。
- [x] 为 Theme 卡片增加可选样式入口，并补充颜色控件驱动整卡预览的组件测试。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-13 | 创建并确认 |
| 2026-10-13 | M3 完成后端设置模型、默认值合并、迁移与 JSON 持久化；前端设置页和保存副作用留待 M4 |
| 2026-10-14 | 明确设置为「编辑 draft，点击 Save 后一次性持久化并生效」；完成阶段 1 的通用设置窗口、保存副作用与调度状态接口 |
| 2026-10-14 | 阶段 1 人工验收通过；SPEC 因设置窗口尚未覆盖全部字段继续保持 `in-progress` |
| 2026-10-15 | 阶段 4 补齐「Start at login」「Breaks」「Menu Bar Text」「Audio」分组与提示音试听；新增 UI 原语（Select/Textarea/Slider）。剩余遮罩与休息流程开关留阶段 5 |
| 2026-10-19 | 按 A8 验收反馈把 Breaks 分组字段改为 `Break type`，选项改为 `Popup break` / `Notification`；自动化验证完成，待人工复验设置入口与持久化 |
| 2026-10-19 | 按人工验收反馈恢复原版四页签结构：`General`、`Working Hours`、`Customization`、`System`；本次仅重组阶段 4 已有字段，阶段 5 字段仍不提前实现 |
| 2026-10-21 | 按 C3 人工验收反馈确认把 `Snooze`、`Skip`、`Advanced` 提前纳入阶段 4；`Breaks enabled` 移入 `Breaks` 标题行，`Working Hours` 改为原版紧凑行内布局并支持复制时间段 |
| 2026-10-21 | 按 C3/C4 专项复验反馈统一 `Break type`、`Frequency`、`Length` 的标题与控件基线，扩大两位秒数显示宽度；`Working Hours` 恢复原生 `time` 控件并保持紧凑布局 |
| 2026-10-21 | C0-C7 Windows 人工验收全部通过：四页签跨页 draft、System/Customization/General 阶段 4 分组与阶段 3 分组回归均符合预期；Theme/Backdrop 等剩余字段留阶段 5 |
| 2026-10-21 | 确认阶段 5 收口方案：补齐 Theme、Backdrop 四个字段，不重做已通过验收的页签布局；`Reset` 同时恢复遮罩透明度默认值 |
| 2026-10-21 | 人工验收发现设置窗口 `X` 会退出应用、托盘无法恢复失焦窗口；确认主窗口关闭改为隐藏到托盘，并统一恢复、显示和聚焦顺序 |
| 2026-10-22 | Theme/Backdrop 与关闭隐藏、托盘恢复实现完成；组件与 Rust 测试通过，等待 Theme/Backdrop、`X` 隐藏、失焦恢复和 Quit 退出的人工复验 |
| 2026-10-22 | 最终便携发布版冒烟确认 `WM_CLOSE` 后进程驻留且窗口隐藏，第二实例恢复的同一路径可使隐藏/最小化窗口重新可见并取得前台焦点；Theme/Backdrop 与 Quit 仍待人工复验 |
| 2026-10-22 | 用户人工验收通过：Theme/Reset/Backdrop 按依赖规则生效并可一次 Save 持久化；`X` 隐藏后应用继续运行；隐藏、最小化、失焦窗口均可由托盘恢复；托盘 `Quit` 正常退出 |
| 2026-10-22 | 便携发布版试用发现 Theme 分组只显示颜色控件，卡片本身不随 draft 变色；确认按旧版行为补齐整卡实时预览，SPEC 回到 `in-progress` |
| 2026-10-22 | `SettingsCard` 增加可选样式入口，Theme 整卡随 draft 背景色/文字色实时更新，Reset 使用跟随文字色的透明按钮；组件测试覆盖初始值、修改与 Reset，33 项设置窗口测试与便携版人工验收通过；SPEC 标记 `done` |
