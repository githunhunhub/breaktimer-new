# 2026-10-19 M4 阶段 4：恢复设置窗口四页签

- 关联：SPEC-0010、PLAN-0002 阶段 4
- 分支：`codex/m4-phase-4`
- 状态：实现与自动化验证完成，等待人工验收 C0-C5

## 验收反馈

- 原版设置窗口分为 `General`、`Working Hours`、`Customization`、`System` 四个页签。
- 当前阶段 4 将设置内容纵向排列在单页中，与用户预期结构不一致。

## 处理结论

- 该页签属于 M4 阶段 4 的设置窗口结构调整，用于恢复原版信息架构。
- 本次只重组阶段 4 已有字段，不提前加入 Theme、Backdrop、Snooze、Skip、Advanced 等阶段 5 字段。

## 实现

- 设置窗口增加四个可键盘切换的页签，默认打开 `General`。
- `General`：休息启用、Breaks、Smart Breaks。
- `Working Hours`：工作时段开关与逐日时间段。
- `Customization`：Audio 与提示音试听。
- `System`：Start at login、Menu Bar Text。
- 四个页签共用同一份 draft 与顶部 Save；切页不会丢失未保存修改，一次 Save 提交完整设置。

## 验证

- 前端：`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（3 files / 24 tests）、
  `pnpm build` 通过。
- Rust：`cargo fmt --all --check`、`cargo check --locked --all-targets`、
  `cargo test --all-targets`（83 tests）通过。
- 自动化覆盖：四页签名称与默认页、跨页编辑保留、单次全量保存、方向键切换。
- Tauri 运行期冒烟：WebView2 DOM 显示四个页签，默认选中 `General`；切换到 `System` 后只渲染
  Start at login 与 Menu Bar Text 内容。验证后开发服务器与应用进程均已停止。

## 待人工验收

1. 打开设置窗口，确认顶部显示四个页签且默认选中 `General`。
2. 分别在四个页签检查对应分组，确认同一时间只显示当前页签内容。
3. 修改两个不同页签后切回，确认 draft 不丢失，顶部 Save 一次保存全部修改。
4. 重新打开设置，确认跨页修改均已持久化。
