# 2026-10-23 多语言支持实现

## 范围

- 按 SPEC-0014 / ADR-0012 / PLAN-0003 实现 `en-US` 与 `zh-CN`。
- React 与 Rust 共用 `app/locales/*.json`；设置字段 `language: string | null`。
- 覆盖设置页、休息页、托盘、About、通知、ARIA 与默认休息文案。

## 已完成

- Task 1-7：共享 catalog、Rust i18n、Provider/IPC、设置页 Language 卡片、休息页、
  托盘/About、通知与 `locale-changed` 广播。
- 自动门禁：前端测试 54 个、Rust 测试 107 个；lint、typecheck、format、build 与
  `cargo check --locked --all-targets` 通过。
- 临时第三语言验证：`fr-FR` 加入时前后端构建通过，删除后再次构建通过，无源码残留。

## 验收

- 首轮人工验收除三项外通过。
- 用户确认 Notification 标题、Snooze 同行对齐和中文短单位“分”三项复验通过。
- L1-L15 全部完成；SPEC-0008、SPEC-0014 与 PLAN-0003 均已收口为 `done`。

## 验收反馈修复

- Notification 标题改为读取 `breakTitle`，默认值翻译，自定义值剥离 HTML。
- Snooze 的“时长”改用 `Label`，与“次数上限”保持同一标签行高和控件基线。
- `common.minutesShort` 的中文值从“分钟”改为“分”。

## 待续

- 未收到提交指令，不执行 Git 提交或推送。
