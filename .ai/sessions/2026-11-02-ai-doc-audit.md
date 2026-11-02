# 2026-11-02 AI 文档审计与整改

## 背景

对「给 AI 看的内容」（`AGENTS.md`、`.ai/`、`docs/` 索引与模板）做一次审计，检查是否符合
文档先行的工作方式与当前最佳实践，并整改发现的问题。本次只改文档与发布脚本的编码细节，
不改功能行为。

## 发现

- **P0 自相矛盾**：`AGENTS.md` 的常用命令声称在 `app/` 下执行，后端命令却用了只在仓库根成立的
  `--manifest-path app/src-tauri/Cargo.toml`；`DEVELOPMENT.md` 有两处硬编码本机绝对路径，
  违反自家「本机路径不入库」；`.ai/memory.md` 自称精简，实际是 83 行流水账。
- **P1 文档漂移**：`docs/architecture.md` 仍写「SPEC-0014，待实现」；`docs/plans/README.md` 缺
  PLAN-0004、PLAN-0002 状态停留在 `confirmed`；`.ai/checklists/` 里 27KB 一次性验收清单无人引用。
- **P2 规范缺口**：缺完成定义（门禁）、提交规范、文档冲突裁决、语言约定；命令表在三个文件重复。
- **P3 卫生**：`release.ps1` 用 PowerShell 5.1 直接 `git commit -m` 传中文，写出 GBK 乱码
  （`4bc6180`）；`docs/plans/0004` 残留外部脚手架的 `superpowers:*` 说明；某条会话记录了作者
  真实邮箱；`develop` 上存在两对同 patch 的重复提交。

## 本次改动

- `AGENTS.md`：修正命令与路径（改为门禁清单，在 `app/` 下执行）；新增「提交与推送」；补充目录地图
  （`.github/`、`app/scripts/`、`DEVELOPMENT.md`、`README.md`）；铁律 3 改为「开发会话」并加入开工
  先读 memory 的动作；规则补充文档冲突处理、语言约定与索引同步。
- `.ai/memory.md`：重写为一屏索引（当前状态 / 不变量与坑 / 未决事项 / 入口），历史细节交由 sessions。
- `docs/decisions/0016-ai-memory-and-single-source-of-truth.md`：记录该决策。
- `DEVELOPMENT.md`：两处 `cd D:\code\breaktimer-new\app` 改为 `cd app`。
- `docs/architecture.md`：多语言资源流标注为已实现。
- `docs/plans/README.md`：补 PLAN-0004，PLAN-0002 改为 `done`。
- `docs/plans/0004-github-tag-release.md`：删除 `superpowers:*` 子技能说明。
- `.ai/sessions/2026-10-22-history-path-sanitization.md`：移除作者真实姓名与邮箱。
- `.ai/checklists/2026-10-15-m4-phase4-acceptance.md`：删除（一次性清单，内容可由 `db2fbb9` 取回；
  验收结论已在 SPEC-0006/0007/0008/0010 的验收标准与 2026-10-21 收口会话中）。
- `app/scripts/release.ps1`：版本提交信息改为写入 UTF-8 临时文件并用 `git commit -F`，
  临时文件在 `finally` 中清理；`app/scripts/release-version.test.mjs` 增加回归测试。

## 未处理

- `develop` 上两对重复提交：不改写已推送历史，仅在 memory 中记录为已知项。
- `4bc6180` 的乱码提交信息：同样不重写历史，修复只对后续发布生效。
- 没有执行任何打包或发布命令；本次未新增 Tag。

## 验证

- 前端：`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 通过；`pnpm test`
  6 个文件 74 个用例全部通过（含新增的提交信息编码回归测试）。
- `release.ps1`：以 Windows PowerShell 5.1 解析器校验语法通过（`ParseFile` 无错误）。
- 文档自检：相对链接全部可解析；无本机绝对路径、无 `superpowers:*` 残留；
  `docs/plans/README.md` 已覆盖 0001-0004。
- Rust 门禁：本次未改 Rust 代码，未执行。
