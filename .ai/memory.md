# AI 跨会话记忆

> 供后续 AI 会话快速接续上下文。保持精简，只写「稳定且重要」的事实与结论。

## 当前状态

- 项目：BreakTimer 重构（两重目的：学习 AI 编程 + 替换 Electron）
- 阶段：M0/M1/M2/M3 完成；`app/` Tauri v2 工程可运行，IPC、插件/托盘骨架与设置持久化后端已落地；下一步按 PLAN-0002 进入 M4 功能重构
- 新代码目录：`app/`（pnpm + Vite + React/TS 前端，`src-tauri/` Rust 后端）
- 旧源码：`breaktimer-app/` 以 git submodule 引用上游，钉在 commit `2d67243`（≈ v2.1.0-54）
- AI 学习笔记目录：`ai-notes/`
- 技术选型：**Tauri v2（Rust）+ 前端保留 React + TypeScript**（ADR-0002）
- 全屏遮挡方案：每显示器一个无边框/透明/置顶/跨工作区窗口；休息阶段 `setFullscreenOnMonitor` 原生全屏 + `setFocusable(false)` 不抢焦点；`showBackdrop=false` 时居中 500×300（对应旧版 soft overlay，非硬锁定）
- `docs/overview.md`、`docs/architecture.md`、`docs/glossary.md` 已补全范围/目标架构/术语
- 跨设备基线：SPEC-0001 已落地 `.gitattributes`、`.editorconfig`、`.gitignore` 与克隆说明
- M3 验证：前端 lint/typecheck/format/test/build 通过；Rust fmt/check/11 tests 通过；真实窗口验证 IPC、设置落盘与重启保留、single-instance 生效。M3 基线已提交为 `c61f425` 并推送 `origin/master`

## 关键约定

- 文档先行，代码是成果（见 `docs/decisions/0001-ai-first-repo-structure.md`）。
- AI 文件不得写入 `app/`。
- 文档工作流：一需求一 spec（`docs/specs/NNNN-*.md`），索引在 `docs/specs/README.md`；小需求计划写在 spec 内，大工程才用 `docs/plans/`；流程细则见 `AGENTS.md`。
- 跨设备同步：能仅凭仓库复现的内容全部纳入 Git；只排除密钥、机器本地状态、依赖目录、构建产物与缓存。

## 待办 / 阻塞

- SPEC-0010 当前为 `in-progress`：后端设置模型/迁移/持久化已完成，M4 续做设置窗口与保存副作用；`docs/specs/README.md` 已同步。
- 按 `docs/plans/0002-implementation-phases.md` 五阶段实现：地基（设置/生命周期）→ 最小闭环（调度+窗口+声音）→ 时间与状态条件 → 系统集成 → 打包发布。
- 声音播放通道（前端 audio vs Rust 音频库）确定后补 ADR。
