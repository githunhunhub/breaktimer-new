# 2026-10-22 休息前提示与 Windows System 设置收尾

- 关联：SPEC-0002、SPEC-0006、SPEC-0010
- 分支：`master`
- 工作区：`<repo-root>` 普通 checkout
- 状态：实现、自动验证、运行态冒烟与用户人工验收全部通过；用户已要求提交并推送

## 本轮输入

用户反馈两个问题：

1. 进入休息前先显示 `Start your break when ready...`，随后再显示
   `Break starting in Ns...`；两个阶段功能重复。
2. Windows `System` 页签中的 `Menu Bar Text` 没有可观察作用。

## 根因与实现

### 休息前提示

- 根因：提示窗口原先复刻旧版 60 秒 grace 阶段加 60 秒 countdown 阶段，后端总时长为
  120 秒，前端根据 elapsed 时间切换文案。
- 实现：后端改为单一 `PROMPT_DURATION_SECONDS = 60` 截止时间；前端提示出现后立即显示
  `Break starting in Ns...`，进度按完整 60 秒窗口计算。
- 交互：`Start`、`Snooze`、`Skip` 与倒计时自然开始休息的行为保持不变。
- 回归：组件测试断言旧文案不存在、单段倒计时立即可见；Rust 测试覆盖 60 秒截止与自然开始。

### Windows System 页签

- 根因：`Menu Bar Text` 对应 macOS 托盘标题能力，当前 Windows 产品没有对应可见效果。
- 实现：Windows 设置窗口的 `System` 页签只渲染 `Start at login`，删除不再使用的
  `TrayCard` 组件。
- 兼容性：保留 `trayTextEnabled`、`trayTextMode` 持久化字段及 macOS 标题逻辑，避免破坏
  设置结构与未来 macOS 支持。
- 回归：组件测试确认 `Start at login` 存在，`Menu Bar Text` 与
  `Show menu bar text` 均不存在。

## 自动验证

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`：39 项通过
- `pnpm build`
- `cargo fmt --all --manifest-path app/src-tauri/Cargo.toml -- --check`
- `cargo check --locked --all-targets --manifest-path app/src-tauri/Cargo.toml`
- `cargo test --all-targets --manifest-path app/src-tauri/Cargo.toml`：93 项通过
- `git diff --check`

## 运行态证据

- Windows 双显示器运行时，提示窗均直接显示 `Break starting in Ns...`，旧
  `Start your break when ready...` 未出现。
- `System` 页签 DOM 只包含 `Start at login`，`Menu Bar Text` 不存在。
- 临时 10 秒频率测试完成后，用户设置文件已从备份恢复，SHA-256 与测试前一致。
- 调试进程与 `1420`、`9223` 监听均已清理。
- 未执行打包，未修改 `breaktimer-app/`。

## 人工验收

2026-10-22 用户回复“验收通过”。SPEC-0002、SPEC-0006、SPEC-0010 已重新标记为 `done`，
对应验收项和实现计划项均已勾选。

## 交付

用户已明确要求提交并推送。实际提交哈希与推送结果将在推送完成后补记。
