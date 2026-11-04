# 实施计划（Plans）索引

> 跨多个 spec 的大工程在此拆解任务；小需求的计划已写在各自 spec 的「实现计划」里。
> 引用方向：`plan → spec → ADR`。
> 状态为 `done` 的计划是**历史记录**，除修订对应功能外无需通读。

| 编号 | 计划 | 覆盖阶段 | 状态 | 关联 |
| --- | --- | --- | --- | --- |
| [PLAN-0001](0001-app-scaffold.md) | 初始化 `app/` Tauri v2 工程骨架 | M3 | done | ADR-0002 · SPEC-0010 |
| [PLAN-0002](0002-implementation-phases.md) | 按依赖顺序实现各功能模块 | M4 | done | SPEC-0002 ~ SPEC-0010 |
| [PLAN-0003](0003-multilingual-support.md) | 多语言支持实施计划 | 后续需求 | done | SPEC-0014 · ADR-0012 |
| [PLAN-0004](0004-github-tag-release.md) | GitHub Tag 发布流水线实施 | 发布 | in-progress | SPEC-0015 · ADR-0013 · ADR-0014 · ADR-0015 |

<!-- 新增 plan 后在此表追加一行 -->
