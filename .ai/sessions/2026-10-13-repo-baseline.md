# 2026-10-13 仓库与文档基线

## 目标

建立「AI 优先、文档即源码」的仓库结构，作为重构起点。

## 做了什么

- 确认整体结构：`docs/` 一等公民文档 + 很小的 `.ai/` + `app/`（代码成果）。
- 新建代码目录 `app/`（由 `breaktimer-new/` 改名）。
- 建立文档骨架：`AGENTS.md`、`README.md`、`docs/*`、`.ai/*`。
- 用 `git submodule` 引用旧上游 `breaktimer-app`，钉在 commit `2d67243`。
- 完成首次基线提交。

## 关键决策

- ADR-0001：AI 优先的仓库结构（文档即源码）。

## 待办

- 推送 `master` 到 `origin`。
- 进入 M1：填写 `docs/overview.md` 与 `docs/specs/*`。
