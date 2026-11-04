# ADR-0022：AI 上下文的索引化与去重复

- 状态：已接受
- 日期：2026-11-05
- 决策者：项目作者
- 关联：ADR-0001 · ADR-0016 · ADR-0021 · `AGENTS.md` · `docs/architecture.md`

## 背景

ADR-0021 退出 `.ai` 后，文档已是唯一事实源，但新会话的必读集仍有约 1.8 万字符，且重复在增长：

- `docs/specs/README.md` 的「代码」列写成了整段验收叙述，与 spec 正文和 roadmap 三处重复。
- `docs/roadmap.md` 的「后续需求」逐条复述 spec 的验收进度，状态要在三处同步。
- 22 条 ADR 没有索引，找「为什么这样选」只能逐个打开文件。
- `docs/architecture.md` 累积了逐功能实现状态（发布、更新、统计、日志等），与 SPEC-0015/0017/
  0018/0019 重复；同时**没有任何文件路径级代码地图**，AI 每次都要重新扫描 `app/`。
- `AGENTS.md` 反复列出的流程细则与 `DEVELOPMENT.md`、ADR 重叠，而它每轮会话都要进上下文。

## 决策

1. `docs/architecture.md` 只保留旧/新结构、多语言资源流、**代码地图**、关键实现不变量和架构差异；
   逐功能实现状态交给各自的 SPEC。
2. 代码地图（关注点 → 主要文件 → 相关 SPEC/ADR）是定位代码的唯一入口；新增或迁移模块时同步补行。
3. `docs/specs/README.md` 的「主要实现」列只放短指针，不写验收结论。
4. `docs/roadmap.md` 只记里程碑级状态；需求状态以 spec 头部与 specs 索引为准。
5. 新增 `docs/decisions/README.md` 作为 ADR 索引；新增 ADR 时同步追加一行。
6. `AGENTS.md` 收敛为「入口 + 不读就会破坏的规则 + 完成定义」，命令与流程细则指向
   `DEVELOPMENT.md` 和对应 ADR；仍保持每次会话可独立读懂。
7. 验证门禁固化为 `app/scripts/verify.ps1`（`pnpm verify`），不含任何打包命令。
8. 已完成的大计划在文件头标注「历史记录」，不移动文件、不破坏历史链接。

## 理由

- 上下文窗口是最稀缺的资源：索引按需展开，比把细节塞进必读文件更便宜。
- 每类信息只有一个归属文件，减少同步责任与漂移。
- 代码地图把「找文件」从每次数条命令降为一次查表，且天然写清模块边界。
- 门禁脚本避免逐条抄写命令，也让本地与他人复现结果一致。

## 影响

- 文档改动：`AGENTS.md`、`docs/architecture.md`、`docs/roadmap.md`、`docs/specs/README.md`、
  `docs/decisions/README.md`、`docs/plans/README.md` 与已完成计划的文件头。
- 代码改动：新增 `app/scripts/verify.ps1` 与 `package.json` 的 `verify` 脚本。
- 历史 ADR 正文不改；索引里的状态统一显示为中文，历史文件中的 `accepted` 等价于「已接受」。
