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
| `docs/specs/` | 需求规格与验收标准 | 按需 |
| `docs/plans/` | 任务拆解 | 按需 |
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

## 常用命令

> `app/` 尚未初始化，待技术栈确定后在此补全：`dev` / `build` / `test` / `lint` / `typecheck`。
