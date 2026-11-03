# ADR-0021：退出 `.ai` 私有过程目录

- 状态：accepted
- 日期：2026-11-03
- 决策者：项目作者
- 关联：SPEC-0001 · `AGENTS.md` · `DEVELOPMENT.md`
- 取代：ADR-0016
- 部分取代：ADR-0001 中的 `.ai/` 目录与 AI 过程文件约定

## 背景

ADR-0001 为 AI 过程文件引入了 `.ai/`，ADR-0016 又将其收敛为 memory 与 sessions 两级。
实践后仍有三个问题：

- `.ai` 不是 Codex 或通用 AI 编程工具的要求，其他项目通常直接以 `AGENTS.md` 和项目文档
  作为入口。
- memory、sessions、roadmap、SPEC、ADR 之间反复同步，信息容易重复或漂移。
- 每次任务都要读取并维护 AI 私有状态，增加了流程与上下文成本，但没有形成同等价值的产品事实源。

## 决策

1. 删除 `.ai/`，不再维护 AI memory、会话日志或私有验收清单。
2. `AGENTS.md` 只负责 AI 协作入口、边界与完成定义；开工时依次阅读 `docs/overview.md`、
   `docs/roadmap.md` 和相关 SPEC / ADR。
3. 当前状态写入 `docs/roadmap.md`；需求、验收步骤与未完成项写入对应 SPEC；
   长期取舍写入 ADR；开发命令以 `DEVELOPMENT.md` 为准。
4. 历史讨论不单独落盘。已经形成的长期结论必须进入上述事实源；其余内容由 Git 历史保留。
5. 新增 SPEC / ADR / PLAN 时同步更新对应索引，不再通过 memory 提供“最近状态”。

## 理由

- 项目事实只保留一套，减少文档之间的重复与同步责任。
- 新会话可从稳定入口恢复，不依赖逐次累积的 AI 私有记忆。
- 工作流对 Codex、其他 coding agent 和人类开发者都一致，降低工具绑定。
- 验收步骤跟随需求文件，后续修改需求时可原地维护。

## 影响

- `AGENTS.md`、`DEVELOPMENT.md`、`docs/overview.md` 与 SPEC-0001 同步移除 `.ai` 约定。
- SPEC-0017、SPEC-0018、SPEC-0019 的未完成人工验收直接保存在各自 spec 中。
- 已完成 PLAN 和历史 ADR 中的 `.ai` 路径保留为历史记录，不再代表当前流程。
- 未来若重新引入 AI 私有缓存，必须先新增 ADR，并证明它不会成为第二事实源。
