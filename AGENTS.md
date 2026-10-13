# AGENTS.md

> 本文件是 AI 协作的**唯一入口**。先读它，再按「目录地图」下钻。
> 核心理念：**文档先行，代码是成果。** 详见 `docs/decisions/0001-ai-first-repo-structure.md`。

## 项目一句话

把旧版 BreakTimer（`breaktimer-app/`，Electron 桌面应用）重构为 `app/` 下的全新实现。

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
| `.ai/sessions/` | 会话 / 进度日志 | AI |
| `app/` | **新代码（成果）** | 按需 |
| `breaktimer-app/` | 旧源码（参考，**只读**） | 参考 |

## 铁律

1. **文档先行**：改代码前先读 `docs/overview.md` 与相关 `docs/specs/*`；需求或设计有变动，先改 `docs/`，再改 `app/`。
2. **决策留痕**：出现架构或技术取舍，写一条 `docs/decisions/NNNN-*.md`（编号递增，**只增不改**）。
3. **会话留痕**：每次重构会话结束，在 `.ai/sessions/` 写一条记录，并更新 `.ai/memory.md`。
4. **边界**：AI 相关文件只能放在仓库根、`docs/`、`.ai/`；**不得写进 `app/`**。
5. **旧源码只读**：不修改 `breaktimer-app/` 内任何内容。

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
- 不为琐碎改动建 spec；只为有长期价值的需求建。

## 常用命令

> `app/` 尚未初始化，待技术栈确定后在此补全：`dev` / `build` / `test` / `lint` / `typecheck`。
