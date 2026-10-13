# AI 跨会话记忆

> 供后续 AI 会话快速接续上下文。保持精简，只写「稳定且重要」的事实与结论。

## 当前状态

- 项目：BreakTimer 重构（两重目的：学习 AI 编程 + 替换 Electron）
- 阶段：M0/M1/M2 完成；需求 spec 已齐全（SPEC-0002 ~ SPEC-0010，全部 confirmed）；下一步 M3 初始化 `app/` Tauri 工程
- 新代码目录：`app/`（当前为空，尚未初始化）
- 旧源码：`breaktimer-app/` 以 git submodule 引用上游，钉在 commit `2d67243`（≈ v2.1.0-54）
- AI 学习笔记目录：`ai-notes/`
- 技术选型：**Tauri v2（Rust）+ 前端保留 React + TypeScript**（ADR-0002）
- 全屏遮挡方案：每显示器一个无边框/透明/置顶/跨工作区窗口；休息阶段 `setFullscreenOnMonitor` 原生全屏 + `setFocusable(false)` 不抢焦点；`showBackdrop=false` 时居中 500×300（对应旧版 soft overlay，非硬锁定）
- `docs/overview.md`、`docs/architecture.md`、`docs/glossary.md` 已补全范围/目标架构/术语
- 跨设备基线：SPEC-0001 已落地 `.gitattributes`、`.editorconfig`、`.gitignore` 与克隆说明

## 关键约定

- 文档先行，代码是成果（见 `docs/decisions/0001-ai-first-repo-structure.md`）。
- AI 文件不得写入 `app/`。
- 文档工作流：一需求一 spec（`docs/specs/NNNN-*.md`），索引在 `docs/specs/README.md`；小需求计划写在 spec 内，大工程才用 `docs/plans/`；流程细则见 `AGENTS.md`。
- 跨设备同步：能仅凭仓库复现的内容全部纳入 Git；只排除密钥、机器本地状态、依赖目录、构建产物与缓存。

## 待办 / 阻塞

- 初始化 `app/` 的 Tauri v2 工程骨架（React + TS 前端、Rust 后端、`invoke`/command IPC）。
- 按 spec 逐个实现（建议先做 SPEC-0003 调度 + SPEC-0002 窗口，跑通最小闭环）。
- `app/` 初始化后，将源码、配置与依赖锁文件一并提交。
