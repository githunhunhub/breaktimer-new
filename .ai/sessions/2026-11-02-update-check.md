# 2026-11-02 更新检查（SPEC-0017）

## 背景

用户要求添加更新检查功能，并确认：

- 采用「只检查 + 提示 + 打开发布页」方案，不做应用内下载安装；
- 自动检查默认启用，设置页提供手动检查；
- 不新增托盘入口；
- 使用 GitHub Releases API 检查稳定版；
- 便携版采用「退出后手动覆盖文件」的更新方式；
- 发现新版本时按「百度网盘、夸克网盘」顺序提供下载入口；GitHub 仅用于检查版本，
  不作为下载入口；
- 当前先用占位配置，夸克 / 百度链接后续补充。

## 文档

- 新增 `docs/specs/0017-update-check.md`（`in-progress`）。
- 新增 `docs/decisions/0018-update-check-scope.md`，记录「不做应用内安装」、GitHub API、
  无托盘入口、便携版手动更新和 Release 元数据方案。
- 更新 `docs/overview.md`、`docs/architecture.md`、`docs/glossary.md`、`docs/roadmap.md`
  与 `docs/specs/README.md`。

## 实现

- 后端新增 `app/src-tauri/src/updates/`：
  - GitHub `releases/latest` 请求、稳定版 `vMAJOR.MINOR.PATCH` 比较；
  - Release 正文隐藏标记 `<!-- breaktimer-downloads {...} -->` 的下载元数据解析；
  - 夸克 / 百度 / GitHub URL 的 HTTPS 与主机白名单校验；
  - 启动后约 30 秒、之后每 24 小时最多一次的自动检查；
  - 同一版本只通知一次，休息进行中延迟通知；
  - 手动检查命令、最近结果查询与打开下载链接命令。
- 设置模型新增 `checkForUpdates`（默认 `true`）；`StoreData` 新增
  `updateLastCheckedAt` 与 `updateLastNotifiedVersion`。
- 设置页 `System` 页签新增 `Updates` 卡片：当前版本、自动检查开关、手动检查、状态、
  下载入口及便携版 / 安装版更新步骤。
- `AppInfo` 新增 `portable`，用于选择便携版或安装版文案。
- 中英文新增完整文案；通知使用 Rust 侧 i18n。
- 新增 `.github/release-downloads.json`（当前为占位空值）与
  `app/scripts/release-downloads.mjs`；发布流水线读取该文件，把可见「下载方式」段落和
  隐藏标记追加到 Release 正文。发布资产清单不变。

## 依赖与坑

- HTTP 使用 `reqwest` 的 `native-tls`，Windows 走 schannel；不要改回 `default-tls` /
  rustls / aws-lc。本机没有 CMake / NASM，aws-lc-sys 无法编译。
- 首次新增 reqwest / native-tls / hyper 依赖时 `cargo check` 会长时间下载与编译；
  不要并行启动多个 `cargo tree` / `cargo check`，会互相抢 registry 锁。

## 验证

- `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（83 个用例）、
  `pnpm build` 全部通过。
- `cargo fmt --all -- --check`、`cargo check --locked --all-targets`、
  `cargo test --locked --all-targets`（118 个用例）全部通过。
- 未执行打包或发布命令，未创建 Tag。

## 待办

- Windows 人工验收：真实 GitHub 检查、断网 / 限流提示、自动检查开关、休息中通知延迟、
  便携版覆盖步骤、安装版提示、中英文界面。
- 用户提供夸克 / 百度分享链接后填入 `.github/release-downloads.json`；下一次正式 Tag
  验证 Release 正文的「下载方式」段落与隐藏标记。
