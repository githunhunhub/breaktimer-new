# AGENTS.md

> 本文件是 AI 协作的**唯一入口**。开工顺序：读本文件 → `.ai/memory.md`（当前状态与未决事项）
> → 最近一条 `.ai/sessions/*` → 按「目录地图」下钻。
> 核心理念：**文档先行，代码是成果。** 详见 `docs/decisions/0001-ai-first-repo-structure.md`。

## 项目一句话

把旧版 BreakTimer（`breaktimer-app/`，Electron 桌面应用）重写为独立的
`BreakTimer-new` 项目，新实现位于 `app/`。

## 目录地图

| 路径 | 作用 | 读者 |
| --- | --- | --- |
| `docs/` | **一等公民文档**：目标、架构、计划、规格、决策 | 人 + AI，常看 |
| `docs/overview.md` | 目标 / 范围 / 非目标 / 约束 | 起点 |
| `docs/roadmap.md` | 开发计划与里程碑 | 起点 |
| `docs/architecture.md` | 现状与目标架构 | 常看 |
| `docs/glossary.md` | 领域术语表（统一语言） | 常看 |
| `docs/specs/` | 需求规格（一需求一文件）+ 索引 `README.md` + 模板 `0000-template.md` | 常看 |
| `docs/plans/` | 大工程的任务拆解（小需求写在 spec 内） | 按需 |
| `docs/decisions/` | ADR：为什么这样决定 | 按需 |
| `.ai/` | **仅 AI 自用**的运行痕迹 | AI |
| `.ai/memory.md` | 跨会话记忆 | AI |
| `.ai/sessions/` | 会话 / 进度日志（含一次性验收清单） | AI |
| `.github/` | CI 与发布流水线（`workflows/release.yml`）、`git-cliff` 配置 | 按需 |
| `app/` | **新代码（成果）** | 按需 |
| `app/scripts/` | 发布与打包脚本（属代码，不是 AI 文件） | 按需 |
| `breaktimer-app/` | 旧源码（参考，**只读**） | 参考 |
| `DEVELOPMENT.md` | 人用的开发 / 发布步骤（完整命令来源） | 常看 |
| `README.md` | 面向用户的安装与使用说明 | 按需 |

## 铁律

1. **文档先行**：改代码前先读 `docs/overview.md` 与相关 `docs/specs/*`；需求或设计有变动，先改 `docs/`，再改 `app/`。
2. **决策留痕**：出现架构或技术取舍，写一条 `docs/decisions/NNNN-*.md`（编号递增，**只增不改**）。
3. **会话留痕**：每次开发会话开始先读 `.ai/memory.md` 与最近一条 `.ai/sessions/*`；结束时在
   `.ai/sessions/` 写一条记录，并**只更新 memory 的状态 / 不变量 / 未决事项**。memory 是索引，
   不是流水账，不要把过程细节再倒回去。
4. **边界**：AI 相关文件只能放在仓库根、`docs/`、`.ai/`；**不得写进 `app/`**。
5. **旧源码只读**：不修改 `breaktimer-app/` 内任何内容。
6. **跨设备同步**：凡能从仓库复现的项目内容（文档、代码、测试、配置、锁文件、AI 记忆与会话）必须纳入 Git；仅密钥、机器本地状态、依赖目录、构建产物与缓存可排除。新增忽略规则时，必须保证被排除内容有明确的重建或恢复方式。
7. **打包需显式授权**：只有用户明确要求“打包”或明确要求生成安装包、发布包时，才执行 `tauri:build`、`portable:build`、bundle 等打包命令；例行验证中的前端 `pnpm build` 不算打包。
8. **分支边界**：日常开发、提交和推送使用 `develop`；`master` 只用于发版合入、版本提交与创建发布 Tag，不在 `master` 上做日常开发。

## 文档工作流

**讨论是易失的，落盘才算事实源。** 每确认一个需求，立即写入 `docs/`，不要依赖对话记忆。

| 信息类型 | 去处 | 何时写 |
| --- | --- | --- |
| 需求 / 规格（做什么、验收标准） | `docs/specs/NNNN-*.md` | 需求确认后 |
| 决策（为什么这么选、取舍） | `docs/decisions/NNNN-*.md` | 存在真实取舍时 |
| 计划（怎么做、拆任务） | 小需求写在 spec 内；大工程用 `docs/plans/` | 需求确认后 |
| 目标 / 范围 / 术语 / 架构 | `docs/overview` · `glossary` · `architecture` | 阶段性更新 |
| 讨论过程 / 探索 | `.ai/sessions/*` | 会话结束 |
| 待续上下文 | `.ai/memory.md` | 会话结束 |
| 一次性验收清单 | `.ai/sessions/*`（随会话归档，不单独建目录） | 验收时 |

### 确认一个需求时

1. **落 spec**：`docs/specs/NNNN-slug.md`（状态 `confirmed`），并在 `docs/specs/README.md` 索引表追加一行。
2. **有取舍** → 补 `docs/decisions/NNNN-*.md`，由 spec 引用（无争议则不建 ADR）。
3. **拆计划**：小需求写进 spec 的「实现计划」；跨多个 spec 才开 `docs/plans/`。
4. **更新** `docs/roadmap.md`（若影响里程碑）。
5. **实现**：`app/` 代码 + 测试，引用 spec 编号。
6. **收尾**：spec 状态改为 `done`；写 `.ai/sessions/*`，更新 `.ai/memory.md`。

### 规则

- **编号永久、不复用**，按创建顺序递增（`SPEC-0001`、`ADR-0002`…）。
- **引用方向固定**：`plan → spec → ADR`；代码/测试注释引用 spec 编号。
- **ADR 只增不改**；spec 可更新，但改动记进「变更记录」。
- 状态生命周期：`draft → confirmed → in-progress → done`（另有 `superseded` / `rejected`）。
- **本机路径不入库**：会话、验收和 AI 文档不得记录真实用户名或本机绝对路径；统一使用 `%USERPROFILE%`、`%APPDATA%`、`<repo-root>` 等占位符。
- **文档与实现冲突**：以实现为准，并在**同一次提交里先修文档**；不要留下互相矛盾的文档。
- **语言**：`docs/`、`.ai/`、提交摘要用中文；代码标识符、注释、测试名用英文，用户可见文案走 `app/locales/`。
- **索引即事实源**：新增 spec / plan / ADR 时同步更新各自的 `README.md` 索引表与状态，同一提交完成。
- 不为琐碎改动建 spec；只为有长期价值的需求建。

## 验证门禁（完成定义）

改代码后，在 `app/` 目录执行，**全部通过**才算完成：

```shell
pnpm install --frozen-lockfile   # 仅依赖变更时
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check
cargo check --locked --all-targets --manifest-path src-tauri/Cargo.toml
cargo test --locked --all-targets --manifest-path src-tauri/Cargo.toml
```

- 也可以先 `cd app/src-tauri`，再省略 `--manifest-path src-tauri/Cargo.toml`。
- 只改文档：不必跑门禁，但要自检链接、索引表、示例命令是否仍然成立。
- 打包（`tauri:build`、`portable:build`、bundle）不在门禁内，见铁律 7；发布流程见 `DEVELOPMENT.md`。
- 需要在真机上看界面时用 `pnpm tauri:dev`；`.ai/*.log` 是被忽略的本地日志。

## 提交与推送

- 提交信息用 Conventional Commits：`<type>(<scope>): <摘要>`，type 取 `feat` / `fix` / `docs` /
  `test` / `ci` / `chore` / `refactor`，摘要用中文。
- 中文提交信息不要用 `git commit -m` 直接传参：Windows PowerShell 5.1 会按 ANSI 代码页写入，
  产生乱码。脚本里改用 UTF-8 文件 + `git commit -F <文件>`。
- 一次提交只做一件事；提交前 `git status --short` 确认没有临时文件或应被忽略的产物。
- 日常把 `develop` 推送到 `github` 与 `origin` 两个远程；`master` 只按发版流程操作（铁律 8）。
