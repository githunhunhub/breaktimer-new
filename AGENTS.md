# AGENTS.md

> 本文件是 AI 协作的**唯一入口**。开工顺序：读本文件 → `docs/overview.md`
> → `docs/roadmap.md` → 相关 SPEC；找取舍先查 `docs/decisions/README.md`，
> 找文件先查 `docs/architecture.md` 的「代码地图」。
> 核心理念：**文档先行，代码是成果。** 详见 ADR-0001、ADR-0021。

## 项目一句话

把旧版 BreakTimer（`breaktimer-app/`，Electron 桌面应用）重写为独立的
`BreakTimer-new` 项目，新实现位于 `app/`。

## 目录地图

| 路径 | 作用 | 读者 |
| --- | --- | --- |
| `docs/` | **一等公民文档**：目标、架构、计划、规格、决策 | 人 + AI，常看 |
| `docs/overview.md` | 目标 / 范围 / 非目标 / 约束 | 起点 |
| `docs/roadmap.md` | 里程碑与当前重点 | 起点 |
| `docs/architecture.md` | 旧/新架构、**代码地图**、关键不变量 | 常看 |
| `docs/glossary.md` | 领域术语表（统一语言） | 常看 |
| `docs/specs/` | 需求规格（一需求一文件）+ 索引 + 模板 | 常看 |
| `docs/decisions/` | ADR：为什么这样决定，索引见 `README.md` | 按需 |
| `docs/plans/` | 大工程的任务拆解（小需求写在 spec 内） | 按需 |
| `.github/` | CI 与发布流水线（`workflows/release.yml`）、宣传页发布（`workflows/pages.yml`）、`git-cliff` 配置 | 按需 |
| `app/` | **新代码（成果）**；命令见 `app/README.md` | 按需 |
| `app/scripts/` | 发布 / 打包 / 验证脚本（属代码，不是 AI 文件） | 按需 |
| `site/` | 对外宣传页（纯静态，中英双语，GitHub Pages 发布；SPEC-0016） | 按需 |
| `server/` | 装机统计端点（EdgeOne Edge Functions + KV，SPEC-0018） | 按需 |
| `breaktimer-app/` | 旧源码（参考，**只读**，不修改） | 参考 |
| `DEVELOPMENT.md` | 人用的开发 / 发布步骤（完整命令来源） | 常看 |
| `README.md` | 面向用户的安装与使用说明 | 按需 |

## 铁律

1. **文档先行**：改代码前先读 `docs/overview.md` 与相关 `docs/specs/*`；需求或设计有变动，先改 `docs/`，再改 `app/`。
2. **决策留痕**：出现架构或技术取舍，新增 `docs/decisions/NNNN-*.md`（编号递增，**只增不改**），并同步索引。
3. **单一事实源**：里程碑状态写 `docs/roadmap.md`，需求与验收写对应 SPEC，长期取舍写 ADR；不维护 AI memory 或会话日志。
4. **边界**：AI 相关文件只能放在仓库根与 `docs/`；**不得写进 `app/`**。代码与用户文档不受此限。
5. **旧源码只读**：不修改 `breaktimer-app/` 内任何内容。
6. **跨设备同步**：凡能从仓库复现的项目内容（文档、代码、测试、配置与锁文件）必须纳入 Git；仅密钥、机器本地状态、依赖目录、构建产物与缓存可排除。新增忽略规则时，必须保证被排除内容有明确的重建或恢复方式。
7. **打包需显式授权**：只有用户明确要求“打包”或明确要求生成安装包、发布包时，才执行 `tauri:build`、`portable:build`、bundle 等打包命令；例行验证中的前端 `pnpm build` 不算打包。
8. **分支边界**：日常开发、提交和推送使用 `develop`；`master` 只用于发版合入、版本提交与创建发布 Tag。细则见 `DEVELOPMENT.md` 与 ADR-0015。

## 文档工作流

**讨论是易失的，落盘才算事实源。** 每确认一个需求，立即写入 `docs/`，不要依赖对话记忆。

| 信息类型 | 去处 |
| --- | --- |
| 需求 / 规格 / 验收（做成什么） | `docs/specs/NNNN-*.md`：确认时新建（状态 `confirmed`），收尾改 `done` |
| 决策（为什么这么选、取舍） | `docs/decisions/NNNN-*.md`，由 spec 引用；无真实取舍则不建 ADR |
| 计划（怎么做、拆任务） | 小需求写进 spec「实现计划」；跨多个 spec 才开 `docs/plans/` |
| 目标 / 范围 / 术语 / 架构 | `docs/overview.md` · `glossary.md` · `architecture.md`（阶段性更新） |

必守规则：

- **编号永久、不复用**，按创建顺序递增（`SPEC-0001`、`ADR-0002`…）；引用方向固定 `plan → spec → ADR`，代码 / 测试注释引用 spec 编号。
- **索引即事实源**：新增 SPEC / PLAN / ADR 时同步对应 `README.md` 索引（`docs/specs`、`docs/plans`、`docs/decisions`）。
- **spec 可更新**，改动记进「变更记录」；**ADR 只增不改**，被推翻时新增一条并用「取代 / 部分取代」引用旧记录。
- 状态生命周期：`draft → confirmed → in-progress → done`（另有 `superseded` / `rejected`）。
- **本机路径不入库**：文档和验收记录不得写入真实用户名或本机绝对路径；统一使用 `%USERPROFILE%`、`%APPDATA%`、`<repo-root>` 等占位符。
- **文档与实现冲突**：以实现为准，并在**同一次提交里先修文档**，不要留下互相矛盾的文档。
- **语言**：`docs/` 与提交摘要用中文；代码标识符、注释、测试名用英文；用户可见文案走 `app/locales/`。
- 不为琐碎改动建 spec；只为有长期价值的需求建。

## 验证门禁（完成定义）

改代码后，在 `app/` 目录执行 `pnpm verify`：它按序运行 `format:check`、`lint`、`typecheck`、
`test`、`build`，以及 `cargo fmt --check`、`cargo check --locked --all-targets`、
`cargo test --locked --all-targets`（脚本：`app/scripts/verify.ps1`），任一失败即非零退出。
依赖变更时先执行 `pnpm install --frozen-lockfile`。

- 也可以先 `cd app/src-tauri/`，再手动运行 cargo 命令并省略 `--manifest-path src-tauri/Cargo.toml`。
- 只改文档：不必跑门禁，但要自检链接、索引表、示例命令是否仍然成立。
- 打包（`tauri:build`、`portable:build`、bundle）不在门禁内，见铁律 7；发布流程见 `DEVELOPMENT.md`。
- 需要在真机上看界面时用 `pnpm tauri:dev`。

## 提交与推送

- 提交信息用 Conventional Commits：`<type>(<scope>): <摘要>`，type 取 `feat` / `fix` / `docs` /
  `test` / `ci` / `chore` / `refactor`，摘要用中文。
- 中文提交信息不要用 `git commit -m` 直接传参：Windows PowerShell 5.1 会按 ANSI 代码页写入，
  产生乱码。脚本里改用 UTF-8 文件 + `git commit -F <文件>`。
- 一次提交只做一件事；提交前 `git status --short` 确认没有临时文件或应被忽略的产物。
- 日常推 `develop` 到 `github`；`master` 只按发版流程操作。
