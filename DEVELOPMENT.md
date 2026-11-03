# BreakTimer-new 开发与维护

用户安装与使用说明见 [README.md](README.md)。

本项目是独立的 BreakTimer 重写项目。**文档先行，代码是成果**：先把目标和方案写清楚，
代码是可再生的产出。

## 从这里读起

1. [`docs/overview.md`](docs/overview.md) —— 目标、范围、非目标
2. [`docs/roadmap.md`](docs/roadmap.md) —— 开发计划
3. [`docs/architecture.md`](docs/architecture.md) —— 现状与目标架构
4. [`AGENTS.md`](AGENTS.md) —— AI 协作约定（也定义了整个目录结构）

## 目录结构

```
docs/            一等公民文档：目标 / 架构 / 计划 / 规格 / 决策
app/             新代码（成果）
breaktimer-app/  旧版源码（参考，只读）
```

## 跨设备开发

项目遵循「能复现的都入库」：文档、代码、测试、配置与依赖锁文件都随 Git 同步；
只排除密钥、机器本地状态、依赖目录、构建产物与缓存。具体约定见
[`SPEC-0001`](docs/specs/0001-cross-device-git-baseline.md)。

新设备首次拉取：

```shell
git clone --recurse-submodules https://github.com/githunhunhub/breaktimer-new.git
```

已克隆但尚未初始化旧源码时：

```shell
git submodule update --init --recursive
```

提交前可用 `git status --short --ignored` 检查是否有本应入库的文件被错误忽略。

## 分支策略

- `develop`：日常开发、提交和推送分支。
- `master`：发版专用分支，只接收 `develop` 的发版合入和发布脚本生成的版本提交。
- GitHub Tag 必须从 `master` 创建。

开发前切换到 `develop` 并与 GitHub 同步：

```powershell
git switch develop
git pull --ff-only github develop
```

日常提交后推送到 GitHub：

```powershell
git push github develop
```

正式发版时先把已确认的 `develop` 合入 `master`，再从 `master` 执行发布命令。不要在
`master` 上直接开发或提交普通修复。

## 装机统计端点

匿名装机统计的服务端在 `server/metrics/`（Cloudflare Worker + D1，SPEC-0018 /
ADR-0019）。首次部署与查询步骤见 `server/metrics/README.md`，要点：

```powershell
cd server/metrics
npx wrangler login
npx wrangler d1 create breaktimer_metrics   # 把 database_id 填进 wrangler.toml
npx wrangler d1 execute breaktimer_metrics --remote --file schema.sql
npx wrangler deploy
```

发布构建必须带上端点环境变量，否则统计能力整体关闭：

```powershell
$env:BREAKTIMER_METRICS_URL = "https://<worker>.workers.dev/v1/collect"
```

本地校验逻辑：`node --test server/metrics/test/validate.test.mjs`。
报表 SQL 在 `server/metrics/queries.sql`，口径见 `docs/specs/0018-installation-metrics.md`。

## 打包与发布

正式发布以 GitHub Actions 为准：

- 打 Tag 前必须完成自动化检查，并由用户明确确认人工验收通过；任一检查或验收未通过时
  不得执行 `pnpm release` 或 `release:tag`。
- 已推送到 GitHub 的 Tag 不可删除、移动或覆盖。发布流水线失败时，修复后使用下一个
  patch 版本重新发布。
- GitHub 推送 `vMAJOR.MINOR.PATCH` Tag 后，自动完成版本校验、前端/Rust 门禁、Windows
  打包、变更日志和 GitHub Release。
- `master` 是发版专用分支；普通 `develop` 提交不会触发打包或发布。
- GitHub 是唯一远程仓库和发布平台，`develop` 与 `master` 只推送到 GitHub（ADR-0017）。
- Workflow 定义见 [`.github/workflows/release.yml`](.github/workflows/release.yml)，
  需求与验收见 [`SPEC-0015`](docs/specs/0015-github-tag-release.md)。

### 正式发布步骤

以下示例发布 `0.2.0`。日常发布只需要在仓库根目录执行：

```powershell
git switch master
git pull --ff-only github master
git merge --no-ff develop
cd app
pnpm release 0.2.0
```

命令会先完成检查和版本更新，然后显示将要执行的操作。输入 `y` 后自动完成：

1. 确认当前位于 `master`，工作区干净，且没有落后于 GitHub。
2. 运行前端和 Rust 的格式、Lint、类型检查、测试与构建。
3. 将四处版本更新为目标版本并检查一致性。
4. 如有版本变化，提交 `chore(release): 发布 <version>`。
5. 推送 `master` 到 GitHub。
6. 创建 annotated Tag，并**只推送 GitHub**。
7. 由 GitHub Actions 自动完成 Windows 打包、变更日志和 GitHub Release。

发布前必须提交所有普通代码和文档修改，否则脚本会拒绝执行。示例中的 `v0.2.0` 一旦已推送，
就不能再通过该命令重新发布；若 Actions 或 Release 发布失败，不要移动该 Tag，应修复后使用
下一个 patch 版本。

查看 Workflow：

```powershell
gh run list --repo githunhunhub/breaktimer-new --limit 5
```

也可以在 GitHub 的
[Actions](https://github.com/githunhunhub/breaktimer-new/actions/workflows/release.yml)
页面查看。只有 `meta`、`build`、`changelog` 全部成功后，`release` Job 才会创建
Release。

Release 应包含：

- `BreakTimer-new_v<version>_x64-setup.exe`
- `BreakTimer-new_v<version>_x64-portable.zip`
- `SHA256SUMS.txt`

变更日志只作为 Release 正文，标题为 `## BreakTimer-new v<version>`，不会上传为 Assets。

发布流水线还会读取仓库根目录的 [`.github/release-downloads.json`](.github/release-downloads.json)，
在 Release 正文末尾追加「下载方式」段落和隐藏的 `breaktimer-downloads` 标记。发布前把夸克 /
百度分享链接填入该文件；留空或 `null` 时对应按钮不会出现。应用显示顺序固定为
「百度网盘、夸克网盘」；GitHub 仅用于检查版本，不作为下载入口（SPEC-0017）。

下载安装包后可核对哈希：

```powershell
Get-FileHash .\BreakTimer-new_v0.2.0_x64-setup.exe -Algorithm SHA256
```

`release:version`、`release:check`、`release:tag` 仍保留用于排障或单独执行，但正常发布不再
需要手工依次运行。不要执行 `git push --tags`。

### 本地手动打包

本地手动打包仅用于调试发布构建，不会自动创建 GitHub Release。打包属于显式操作，执行前应
确认需求和版本号。

```powershell
cd app
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build

cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check
cargo check --locked --all-targets --manifest-path src-tauri/Cargo.toml
cargo test --locked --all-targets --manifest-path src-tauri/Cargo.toml
```

先生成便携 ZIP，再复用同一份 release executable 生成 NSIS：

```powershell
pnpm portable:build
pnpm tauri bundle --bundles nsis --no-binary-patching
```

产物位置：

- `app/src-tauri/target/release/bundle/nsis/`
- `app/src-tauri/target/release/bundle/portable/`

构建产物不提交到 Git。正式发布不要直接手工上传本地包，优先由 `vMAJOR.MINOR.PATCH`
Tag 触发 GitHub Actions，确保包、版本、变更日志和哈希来自同一提交。
