# AI 跨会话记忆

> 这是跨会话接续用的**索引**：只写当前状态、不变量、未决事项。过程细节在
> `.ai/sessions/`，规范在 `AGENTS.md`。不要在这里追加流水账（ADR-0016）。

## 当前状态（更新于 2026-11-02）

- 阶段：M0-M5 重构已结束，进入正常需求流程；SPEC-0001 ~ 0014 均 `done`，SPEC-0015
  `in-progress`（R14 / R15 待下一次正式 Tag 验证）；About 项目源码链接已于 2026-11-02
  改为 GitHub 主仓库；SPEC-0017 更新检查已实现并通过自动化门禁，状态 `in-progress`，
  待 Windows 人工验收与网盘链接补齐。
- 平台：仅 Windows 10 / 11 x64 参与验收与发布；macOS / Linux 保留兼容分支，不在当前范围。
- 技术栈：Tauri v2（Rust）+ React / TypeScript；新代码在 `app/`，旧 Electron 源码在
  `breaktimer-app/`（submodule，只读）。
- 产品身份：显示名 `BreakTimer-new`，npm / Cargo / 可执行文件 `breaktimer-new`，
  identifier `com.githunhunhub.breaktimernew`；不迁移、不清理旧版数据。
- 分支与远程：`develop` 日常开发；`master` 只接收发版合入与发布脚本的版本提交；GitHub
  是唯一远程仓库，`develop` / `master` 只推 GitHub，本地已移除 Gitee 的 `origin`（ADR-0017）。
- 发布：`app/` 下 `pnpm release <version>`；Tag `vX.Y.Z` 从 `master` 创建、只推 GitHub；
  已推送的 Tag 不移动，失败改用下一个 patch。最新版本 `v0.1.1`（2026-10-26）。
- SPEC-0018 装机统计 `in-progress`：客户端与 Cloudflare Worker + D1 端点均已实现并通过
  自动化门禁，待 Windows 人工验收；口径为装机（install ID）而非用户。

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
- 发布只认 `github/master`：`pnpm release` 不再 fetch/推送 Gitee，也不要重新添加 Gitee 远程。
- 更新检查（SPEC-0017）：只检查与打开发布页，不下载 / 安装；自动检查默认开启，启动后
  约 30 秒、之后每 24 小时一次；便携版必须退出后手动覆盖并保留 `data\`。
- 装机统计（SPEC-0018）：只允许白名单字段（`installId`、`day`、`firstLaunchDay`、
  `version`、`os`、`arch`、`locale`、`channel`）；禁止 IP、用户名、硬件指纹、路径与内容；
  更新检查本身仍不上报统计，两件事不要混在一起。
- 装机统计不发送启动通知或弹窗（ADR-0020）；披露只在设置页卡片与 README 隐私段落。
- 统计端点必须由构建期环境变量 `BREAKTIMER_METRICS_URL` 提供（发布用仓库变量
  `vars.BREAKTIMER_METRICS_URL`）；未设置时 `telemetry` 整体关闭，fork 不会上报。
- 开发构建不上报统计；请求失败 30 分钟后才重试，不要改成每分钟重试。
- 更新检查的 HTTP 依赖固定使用 `reqwest` + `native-tls`（Windows schannel）；本机没有
  CMake / NASM，不要切回 rustls / aws-lc，也不要并行跑多个 cargo 命令抢 registry 锁。
- 网盘下载链接在 `.github/release-downloads.json`，当前为空占位；发布流水线把它写入
  Release 正文的可见段落和隐藏 `breaktimer-downloads` 标记。应用顺序为百度、夸克；
  GitHub 仅用于检查版本，不作为下载入口。
- 已知历史遗留：`develop` 上有两对同 patch 的重复提交（`v0.1.1` 期间），历史不改写，
  changelog 可能重复列条目。
- 文档与实现冲突时以实现为准，并在同一次提交里先改文档。

## 未决事项

- SPEC-0015 R14 / R15：下一次正式 Tag 端到端确认 Release 标题带 `v`、Assets 仅含安装包、
  便携 ZIP 与 `SHA256SUMS.txt`，且 Tag 前置门禁生效。
- SPEC-0016 宣传页仍为 `draft`：Q1~Q6（站点目录 `site/`、托管平台、自定义域名、语言、
  截图素材、`LICENSE` 与页脚署名）需用户确认后才能转 `confirmed` 并开工。
- SPEC-0017 更新检查：需 Windows 人工验收；夸克 / 百度分享链接待用户提供后填入
  `.github/release-downloads.json`，并在下一次正式 Tag 验证 Release 正文下载段落。
- SPEC-0018 装机统计：待 Windows 人工验收（抓包确认请求体、断网补报、关闭开关、
  便携版与安装版各一次）；需先部署 `server/metrics` 并设置仓库变量，才能端到端验证。
- macOS / Linux 若要支持，需单独立项并定义验收，不能沿用「保留兼容分支」的默认。
- 打包始终需要用户显式授权。

## 入口

- 规范与目录地图：`AGENTS.md`；开发与发布命令：`DEVELOPMENT.md`
- 需求索引：`docs/specs/README.md`；计划索引：`docs/plans/README.md`；决策：`docs/decisions/`
- 最近会话：`2026-11-02-update-check.md` · `2026-11-02-landing-page-requirement.md` ·
  `2026-11-02-installation-metrics.md` · `2026-11-02-gitee-decommission.md` ·
  `2026-11-02-about-source-link.md` ·
  `2026-11-02-ai-doc-audit.md`
