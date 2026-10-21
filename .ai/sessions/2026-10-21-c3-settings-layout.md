# 2026-10-21 M4 阶段 4：C3/C4 设置布局修正

- 关联：SPEC-0010、PLAN-0002 阶段 4
- 分支：`codex/m4-phase-4`
- 工作区：`<repo-root>` 普通 checkout，不是额外 Git worktree
- 状态：C3/C4 专项人工复验通过；实现、自动化与运行期验证完成，准备提交

## 验收反馈

- C3：`Breaks enabled` 被单独分成一组，应移动到 `Breaks` 标题行右侧；
  General 还缺少 `Snooze`、`Skip`、`Advanced` 分组。
- C4：Working Hours 的开关、星期、开始/结束时间、删除、添加与复制应排在同一行；
  单时间段不显示删除按钮，添加使用纯 `+` 图标，时间框与图标之间不能出现大段空白。

## 实现

- General 分组顺序调整为 `Breaks`、`Smart Breaks`、`Snooze`、`Skip`、`Advanced`。
- `Breaks enabled` 移入 `Breaks` 卡片标题行，作为该分组开关。
- 新增 `Snooze`、`Skip`、`Advanced`：
  - Snooze 包含启用开关、分/秒时长与 Limit；
  - Skip 包含允许跳过休息开关；
  - Advanced 包含立即开始休息与允许提前结束；
  - 保留原版依赖：立即开始休息开启时，Snooze/Skip 不可操作。
- `Breaks` 中 `Break type`、`Frequency`、`Length` 统一使用同一标题组件；秒字段改为居中的两位数字
  文本输入，扩大宽度并移除原生数字框增减按钮。
- Working Hours 改为紧凑行内布局，保留带原生时钟图标的 `<input type="time">`，通过缩小宽度、
  内边距和图标间距保持紧凑。
- 单时间段不显示删除按钮；点击 `+` 新增后才显示对应删除入口。
- 复制面板支持把一个星期的全部时间段复制到多个目标星期。
- 受控的原生时间输入框在复制 draft 后直接同步显示新值，不再需要重挂载。
- 新增共享 `SettingsCard` 与 `DurationInputs`，保证分组标题、开关与时长输入样式一致。

## 验证

- 前端：`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（3 files / 33 tests）、
  `pnpm build` 通过。
- Rust：本轮未改 Rust；此前 `cargo fmt --all -- --check`、`cargo check --locked --all-targets`、
  `cargo test --all-targets`（83 tests）通过。
- 自动化覆盖：General 分组顺序与标题行开关、Snooze/Skip 依赖状态、跨页 draft、
  `Break type`/`Frequency`/`Length` 统一标题、两位秒数、原生 `time` 输入（`step=60`）、
  单段无删除、新增/删除、复制到已启用星期后的即时刷新。
- WebView2 CDP 运行期复核：
  - `Break type`、`Frequency`、`Length` 三个标题顶部均为 `y=213.6`，对应控件顶部均为 `y=235.6`；
  - 秒字段实际输入 `34` 后完整显示，字体与光标不挤压，截图中无数字增减按钮；
  - Working Hours 时间框为 `type="time"`、`step="60"`，显示原生时钟图标；`104×36` 紧凑输入框、
    `to`、`+`、复制和删除按钮与开始/结束时间保持同一行。
- CDP 复核结束后已刷新页面恢复草稿，未点击 Save；当前 Settings 默认回到 `General`，Save 为禁用状态。
- 开发实例保持运行：Vite `http://localhost:1420/`，WebView2 CDP `http://127.0.0.1:9222/`。

## 人工验收结果

2026-10-21 用户确认 C3/C4 清单全部验证通过：

1. C3：`Break type`、`Frequency`、`Length` 的标题与控件基线符合预期。
2. C3：`Frequency`、`Length` 的两位秒数完整可见。
3. C4：原生时间框保留时钟图标，`to`、`+`、复制/删除按钮保持同一行。
4. C3：General 分组、Snooze/Skip/Advanced 字段、依赖关系与跨页 draft 符合预期。
5. C4：单段无删除、`+` 新增/删除、复制同步与保存重载符合预期。
6. C4：关闭/重新开启星期时，时间与操作按钮的显示行为符合预期。

本次提交包含代码、测试、文档、`.ai/memory.md` 与本会话记录，并推送
`origin/codex/m4-phase-4`。M4 阶段 4 的其他验收项不因本次提交自动标记完成。
