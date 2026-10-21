# 2026-10-19 M4 阶段 4：A8/A9 运行期问题修复

- 关联：SPEC-0002、SPEC-0006、SPEC-0008、SPEC-0010、PLAN-0002 阶段 4、ADR-0007
- 分支：`codex/m4-phase-4`
- 状态：修复与自动化验证完成，等待用户专项复验 A8/A9/A14

## 验收反馈

- A8：设置中只看到 Popup 行为，未找到 Notification 模式入口；原字段 `Type` / `Simple notification` 不够明确。
- A8/A9：Popup 副屏只覆盖左上区域，未覆盖完整显示器。
- A9：休息期间仍可点击任务栏和托盘，不符合“必须通过 `Cancel Break` 退出”的新语义。

## 根因

- 激活休息沿用了提示条的 `focusable:false` 软遮挡策略，窗口不获取焦点。
- `showBackdrop=false` 直接复用居中的 500×300 小窗，窗口几何与视觉策略没有分离。
- Windows 混合 DPI 下先设置尺寸再移动窗口，系统可能按旧显示器缩放重算物理 bounds，导致副屏只覆盖左上区域。
- 从 Tauri 事件循环线程同步创建 WebView 会把工作投递回同一事件循环并等待自身，存在启动休息窗时卡住的风险。

## 修复

- 设置字段改为 `Break type`，选项为 `Popup break` / `Notification`。
- 引入 `WindowPresentation` 分离提示条与激活休息的几何、焦点策略。
- 提示条保持不可聚焦；激活 Popup 休息覆盖每个显示器完整 bounds、可聚焦、置顶并主动获取焦点。
- `showBackdrop` 只控制渲染层视觉，不再决定窗口尺寸；激活休息按钮统一为 `Cancel Break`。
- `apply_geometry` 改为先移动再设置尺寸，处理混合 DPI。
- `show_prompt` / `show_break` 的窗口创建工作移到工作线程，并用全局窗口操作锁串行化同名窗口创建。
- 新增 ADR-0007，更新 SPEC-0002/0006/0008/0010、架构、术语、路线图和验收清单。

## 验证

- Rust：`cargo fmt --all -- --check`、`cargo check --locked --all-targets`、`cargo test --all-targets` 通过，83 tests。
- 前端：`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（3 files / 21 tests）、`pnpm build` 通过。
- Windows 双屏运行期：两个休息 WebView 均覆盖各自显示器，两个休息页都显示 `Cancel Break`；主/副屏任务栏与托盘区域点击均命中休息窗；取消后窗口关闭，任务栏恢复 explorer。
- Notification 运行期：命令约 8.8 ms 返回，未创建休息窗。
- 测试后已恢复用户测试设置：`POPUP`、频率 10 秒、休息 120 秒、立即开始开启、`showBackdrop=true`、休息启用、工作时段关闭、自启动关闭。
- 运行中的应用与开发服务器已停止，`9223/1420` 无残留监听。

## Git 工作流说明

本次和历史阶段都在 `<repo-root>` 普通 checkout 中使用功能分支，不是实际 Git worktree。
`git worktree list --porcelain` 当前只有这一处工作区，也没有 Linked Worktree。分支是 Git 引用，
worktree 是同一仓库的额外 checkout；两者不是互斥关系，可以同时使用。

## 待用户验收

1. A8.1：`Break type` 入口与选项可见、可持久化。
2. A8.2：Notification 模式 `Start break now` 只发系统通知，不弹休息窗。
3. A8.3/A9.1：Popup 模式完整覆盖所有显示器。
4. A9.2：休息期间任务栏与托盘不可点击。
5. A9.3/A14：点击 `Cancel Break` 关闭所有窗口，随后托盘恢复可操作。
