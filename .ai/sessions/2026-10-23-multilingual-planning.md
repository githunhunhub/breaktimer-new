# 2026-10-23 多语言支持规划

- 关联：SPEC-0014、ADR-0012、PLAN-0003
- 分支：`master`
- 工作区：`<repo-root>` 普通 checkout
- 状态：规格与实施计划完成，待另一个开发会话开始实现；未提交、未推送、未打包

## 本轮输入

用户确认采用共享 JSON 翻译资源方案，并要求先完成相关文档和规划，之后再在另一个会话开始开发。
已确认产品边界包括：

- 首版 `en-US` / `zh-CN`，默认跟随系统，保存后即时切换。
- `language: string | null`，旧设置缺字段按 `null`。
- React 与 Rust 共用 `app/locales/<locale>.json`，新增普通 LTR 语言只增加文件并构建。
- 消息只支持 `{name}` 与 `one` / `other`；不引入完整 ICU。
- 用户自由输入原样显示；只有精确等于旧内置英文默认值的休息标题/消息使用内置翻译。
- 语言选择放在 `System` 页签的 `Start at login` 上方。
- 托盘继续使用稳定根菜单原地更新，语言变化不得重建根菜单。

## 本轮落盘

- SPEC-0014 状态保持开发前语义 `confirmed`，验收项补充 `L1`-`L15` 编号。
- 新增 PLAN-0003，固定文件边界、TypeScript/Rust 接口、翻译 key/文案、8 个 TDD 任务、
  第三语言验证、完整自动化门禁和 Windows 人工验收步骤。
- 更新 spec/plan 索引、roadmap、overview、architecture 与 glossary。
- ADR-0012 保留“共享 JSON + 轻量消息格式、不引入完整 ICU”的取舍。

## 当前工作区说明

工作区仍有上一轮探索性生成的未提交 `app/locales/`、`app/src/lib/i18n.tsx` 与
`app/src/lib/i18n.test.ts` 草稿。它们不计入本轮文档完成状态；正式实现必须按 PLAN-0003
核对或重写，不能另起第二套接口。

## 文档检查

- 对全部本轮涉及文档运行 Prettier。
- `git diff --check`：通过。
- PLAN-0003 文案表共 128 个 key，重复 key 为 0。
- SPEC/PLAN/ADR 文件与索引链接均存在，状态均为开发前 `confirmed`。
- 新增 AI/文档中未出现本机绝对路径。
- 未运行应用测试；本轮没有完成业务实现，正式 TDD 与完整门禁在开发会话执行。

## 下一步

在另一个会话中先读取 `AGENTS.md`、SPEC-0014、ADR-0012 与 PLAN-0003，从 Task 1 开始，
每个测试先确认 RED，再写最小实现。人工验收通过前不提交或推送。
