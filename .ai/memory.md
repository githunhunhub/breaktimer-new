# AI 跨会话记忆

> 供后续 AI 会话快速接续上下文。保持精简，只写「稳定且重要」的事实与结论。

## 当前状态

- 项目：BreakTimer 重构
- 阶段：M0 仓库与文档基线已完成，准备进入 M1 需求梳理
- 新代码目录：`app/`（当前为空，尚未初始化）
- 旧源码：`breaktimer-app/` 以 git submodule 引用上游，钉在 commit `2d67243`（≈ v2.1.0-54）

## 关键约定

- 文档先行，代码是成果（见 `docs/decisions/0001-ai-first-repo-structure.md`）。
- AI 文件不得写入 `app/`。

## 待办 / 阻塞

- 推送 `master` 到 `origin`（gitee）。
- 进入 M1：`docs/overview.md` 与 `docs/specs/*` 尚为 TODO。
