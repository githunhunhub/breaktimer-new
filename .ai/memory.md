# AI 跨会话记忆

> 供后续 AI 会话快速接续上下文。保持精简，只写「稳定且重要」的事实与结论。

## 当前状态

- 项目：BreakTimer 重构（两重目的：学习 AI 编程 + 替换 Electron）
- 阶段：M0 仓库与文档基线已完成，进入 M1 需求梳理 + 技术选型
- 新代码目录：`app/`（当前为空，尚未初始化）
- 旧源码：`breaktimer-app/` 以 git submodule 引用上游，钉在 commit `2d67243`（≈ v2.1.0-54）
- AI 学习笔记目录：`ai-notes/`
- 技术选型：候选 Tauri v2（待确认，详见 session 日志）
- 跨设备基线：SPEC-0001 已落地 `.gitattributes`、`.editorconfig`、`.gitignore` 与克隆说明

## 关键约定

- 文档先行，代码是成果（见 `docs/decisions/0001-ai-first-repo-structure.md`）。
- AI 文件不得写入 `app/`。
- 文档工作流：一需求一 spec（`docs/specs/NNNN-*.md`），索引在 `docs/specs/README.md`；小需求计划写在 spec 内，大工程才用 `docs/plans/`；流程细则见 `AGENTS.md`。
- 跨设备同步：能仅凭仓库复现的内容全部纳入 Git；只排除密钥、机器本地状态、依赖目录、构建产物与缓存。

## 待办 / 阻塞

- 推送 `master` 到 `origin`（gitee）。
- 确认技术选型（Tauri v2 vs Wails v2）。
- 填写 `docs/overview.md` 的「范围」，写技术选型 ADR。
- 进入 M1：梳理产品需求（后续 spec 从 SPEC-0002 起）。
- `app/` 初始化后，将源码、配置与依赖锁文件一并提交。
