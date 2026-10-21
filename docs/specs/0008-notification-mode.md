# SPEC-0008：通知模式（Notification）

- 状态：done
- 实现状态：阶段 4 完成；`Break type` 入口、系统通知、不建休息窗、声音与续排已在 Windows 人工验收通过
- 日期：2026-10-13
- 关联：ADR-0002 · SPEC-0003 · 旧实现 `breaktimer-app/app/main/lib/notifications.ts`、`breaks.ts`

## 背景 / 问题

旧版支持两种提醒方式：Popup（全屏遮挡休息窗）与 Notification（系统原生通知）。Notification 模式不弹全屏窗，只发系统通知，适合不希望被打断太强的场景。

## 需求（做什么）

1. 当 `notificationType=Notification` 时，休息触发发一条系统通知（标题「Time for a break!」，正文为去除 HTML 标签的 `breakMessage`）。
2. 可依设置播放开始提示音（见 SPEC-0009）。
3. 通知模式下休息立即计入完成，并直接安排下一次休息（不再显示休息窗口）。
4. Windows 上通知遵循系统默认展示时长，应用不在展示后强制关闭。

## 验收标准（可测）

> 「通知正文纯文本」已由 `strip_html` 单元测试覆盖；其余条目已在 Windows 真实桌面运行验收，通知关闭时长遵循系统默认行为（ADR-0006）。

- [x] 选择 Notification 模式后，休息触发只发系统通知，不出现全屏休息窗。
- [x] 通知正文为纯文本（HTML 标签被剥离）。
- [x] 通知发出后按正常频率继续调度下一次休息。
- [x] Windows 通知按系统默认行为消失并进入通知中心，不永久遮挡桌面。
- [x] 若设置了提示音，通知发出同时播放提示音。

## 非目标 / 边界

- 不实现通知点击后的跳转行为（旧版未做）。
- 通知外观/图标复用现有资源，不做自定义富媒体通知。
- macOS/Linux 通知差异不在当前里程碑范围内。

## 设计要点（可选）

- 使用 Tauri 官方 notification 插件（或等价系统通知能力），替代 Electron `Notification`。

## 实现计划

- [x] 接入系统通知能力。
- [x] 调度器在 Notification 模式下走通知分支。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-13 | 创建并确认 |
| 2026-10-15 | 进入 M4 阶段 4 实现；非 macOS 通知关闭依赖系统默认行为（ADR-0006） |
| 2026-10-15 | 阶段 4 实现完成：`flow` 按 `notificationType` 分流，Notification 模式发系统通知、播放开始音并立即完成续排；正文剥离 HTML 有测试覆盖。不弹遮罩窗、5 秒关闭与提示音同时播放待运行期验收 |
| 2026-10-19 | 设置入口由模糊的 `Type`/`Simple notification` 改为 `Break type`/`Notification`；运行期检查确认 Notification 命令未创建休息窗，待用户复验系统通知外观、声音与续排 |
| 2026-10-21 | Windows B 组人工验收全部通过：只发通知、正文纯文本、系统默认关闭、提示音同时播放并正常续排；状态更新为 `done`，macOS/Linux 移出当前范围 |
