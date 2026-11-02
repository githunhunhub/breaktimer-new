# AI 跨会话记忆

> 这是跨会话接续用的**索引**：只写当前状态、不变量、未决事项。过程细节在
> `.ai/sessions/`，规范在 `AGENTS.md`。不要在这里追加流水账（ADR-0016）。

## 当前状态（更新于 2026-11-02）

- 阶段：M0-M5 重构已结束，进入正常需求流程；SPEC-0001 ~ 0014 均 `done`，SPEC-0015
  `in-progress`（R14 / R15 待下一次正式 Tag 验证）。
- 平台：仅 Windows 10 / 11 x64 参与验收与发布；macOS / Linux 保留兼容分支，不在当前范围。
- 技术栈：Tauri v2（Rust）+ React / TypeScript；新代码在 `app/`，旧 Electron 源码在
  `breaktimer-app/`（submodule，只读）。
- 产品身份：显示名 `BreakTimer-new`，npm / Cargo / 可执行文件 `breaktimer-new`，
  identifier `com.githunhunhub.breaktimernew`；不迁移、不清理旧版数据。
- 分支：`develop` 日常开发；`master` 只接收发版合入与发布脚本的版本提交；GitHub 为主仓库，
  Gitee 仅备份 `develop` 与 `master`。
- 发布：`app/` 下 `pnpm release <version>`；Tag `vX.Y.Z` 从 `master` 创建、只推 GitHub；
  已推送的 Tag 不移动，失败改用下一个 patch。最新版本 `v0.1.1`（2026-10-26）。

## 不变量与坑

- Popup 休息：每显示器一个无边框 / 置顶 / 跨工作区窗口；提示条不可聚焦，激活休息后切换为
  可聚焦并铺满显示器 bounds 阻断输入；`showBackdrop` 只控制视觉（ADR-0004、ADR-0007）。
- 托盘：菜单与标题调用必须 marshal 到主线程；根菜单只绑定一次，倒计时用 `set_text` 原地更新，
  否则 Windows 菜单会自动关闭或残留白点（ADR-0010）。
- 便携模式：仅可执行文件同目录的普通文件 `portable.flag` 启用；数据写入 `data\`，目录不可写时
  报错退出，不回退 AppData（SPEC-0012）。
- 设置保存：只有休息频率或启停状态变化才重启调度，其他字段保留当前倒计时。
- i18n：`app/locales/*.json` 由 React 与 Rust 共用；`language=null` 跟随系统，保存后广播
  `locale-changed`（ADR-0012）。
- 发布脚本的中文提交信息必须走 UTF-8 文件 + `git commit -F`；PowerShell 5.1 直接 `-m` 会写出
  GBK 乱码（`4bc6180` 是历史案例）。
- 已知历史遗留：`develop` 上有两对同 patch 的重复提交（`v0.1.1` 期间），历史不改写，
  changelog 可能重复列条目。
- 文档与实现冲突时以实现为准，并在同一次提交里先改文档。

## 未决事项

- SPEC-0015 R14 / R15：下一次正式 Tag 端到端确认 Release 标题带 `v`、Assets 仅含安装包、
  便携 ZIP 与 `SHA256SUMS.txt`，且 Tag 前置门禁生效。
- macOS / Linux 若要支持，需单独立项并定义验收，不能沿用「保留兼容分支」的默认。
- 打包始终需要用户显式授权。

## 入口

- 规范与目录地图：`AGENTS.md`；开发与发布命令：`DEVELOPMENT.md`
- 需求索引：`docs/specs/README.md`；计划索引：`docs/plans/README.md`；决策：`docs/decisions/`
- 最近会话：`2026-11-02-ai-doc-audit.md` · `2026-10-26-release-tag-gate.md` ·
  `2026-10-26-release-changelog-assets.md`
