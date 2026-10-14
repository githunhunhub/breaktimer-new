# AI 跨会话记忆

> 供后续 AI 会话快速接续上下文。保持精简，只写「稳定且重要」的事实与结论。

## 当前状态

- 项目：BreakTimer 重构（两重目的：学习 AI 编程 + 替换 Electron）
- 阶段：M0/M1/M2/M3 完成；M4 阶段 1/3 已完成；阶段 2「调度 + 休息窗 + 声音」核心闭环已实现，自动化验证与 Windows 人工验收通过，macOS/Linux 平台验收待做；下一步阶段 4 系统集成
- 新代码目录：`app/`（pnpm + Vite + React/TS 前端，`src-tauri/` Rust 后端）
- 旧源码：`breaktimer-app/` 以 git submodule 引用上游，钉在 commit `2d67243`（≈ v2.1.0-54）
- AI 学习笔记目录：`ai-notes/`
- 技术选型：**Tauri v2（Rust）+ 前端保留 React + TypeScript**（ADR-0002）
- 遮挡方案：每显示器一个无边框/透明/置顶/跨工作区/不抢焦点窗口；休息阶段用显示器 bounds 铺满实现 soft overlay，不调用原生全屏（ADR-0004）；`showBackdrop=false` 时居中 500×300
- 声音方案：Rust `rodio` 播放嵌入 WAV，后端在休息开始/结束转换时触发（ADR-0003）
- 系统状态方案：`BreakScheduler` 接收 `SchedulerContext`；`system_state` 提供空闲/锁屏状态，Windows 探测输入桌面，macOS/Linux 暂按空闲/不可用降级（ADR-0005）
- `docs/overview.md`、`docs/architecture.md`、`docs/glossary.md` 已补全范围/目标架构/术语
- 跨设备基线：SPEC-0001 已落地 `.gitattributes`、`.editorconfig`、`.gitignore` 与克隆说明
- M3 验证：前端 lint/typecheck/format/test/build 通过；Rust fmt/check/11 tests 通过；真实窗口验证 IPC、设置落盘与重启保留、single-instance 生效。M3 基线已提交为 `c61f425` 并推送 `origin/master`
- M4 阶段 1：设置窗口改为 draft + 点击 Save；后端按纯函数副作用处理自启动、启用休息时重置计时和调度重启；开发构建跳过真实自启动注册
- M4 阶段 1 验证：Rust 24 tests、`cargo check --locked --all-targets`、前端 lint/typecheck/format/test/build 全部通过；CDP 端到端验证 Save 落盘、重启保留和 single-instance；2026-10-14 用户人工验收通过；测试后已恢复用户原设置
- M4 阶段 2 验证：Rust fmt/check 通过，`cargo test --all-targets` 50 tests 通过；前端 lint/typecheck/format/test/build 通过，Vitest 8 tests；核心状态机、窗口几何、提示条宽度、声音资源映射和休息窗交互已有测试
- M4 阶段 2 Windows 人工验收（2026-10-14）：多显示器窗口、焦点保持、跨工作区可见性、开始/结束声音、结束流程均通过；测试后已恢复用户原设置
- M4 阶段 2 提交：`codex/m4-phase-2` 提交 `17c42d7`，以 `--no-ff` 合入 `master`（merge `e9b4fb3`）并推送 `origin/master`
- M4 阶段 3：工作时段逐日/多时间段判定、进入工作时段重置、空闲阈值重置与可选通知、长 tick/锁屏恢复全部接入；设置窗口新增 Working Hours 与 Smart Breaks 分组
- M4 阶段 3 验证：Rust all-target tests、locked all-target check 通过；前端 test/lint/typecheck/format/build 通过；测试覆盖工作时段边界、空闲重置与通知开关、禁用空闲、长休眠/锁屏恢复

## 关键约定

- 文档先行，代码是成果（见 `docs/decisions/0001-ai-first-repo-structure.md`）。
- AI 文件不得写入 `app/`。
- 文档工作流：一需求一 spec（`docs/specs/NNNN-*.md`），索引在 `docs/specs/README.md`；小需求计划写在 spec 内，大工程才用 `docs/plans/`；流程细则见 `AGENTS.md`。
- 跨设备同步：能仅凭仓库复现的内容全部纳入 Git；只排除密钥、机器本地状态、依赖目录、构建产物与缓存。

## 待办 / 阻塞

- SPEC-0010 当前为 `in-progress`：阶段 1 已完成，但设置窗口仅覆盖「通用」分组；余下分组与字段在后续阶段补齐。
- SPEC-0002：代码、自动化验证与 Windows 多显示器/焦点/跨工作区人工验收已完成；`showBackdrop=false`、推迟/跳过按钮、混合 DPI 与 macOS/Linux 平台限制待验证。
- SPEC-0009：播放通道、资源映射与 Windows 真实音频人工验收已完成，状态 `done`。
- SPEC-0003：阶段 2/3 核心完成；剩余托盘项属阶段 4。
- 按 `docs/plans/0002-implementation-phases.md` 继续：阶段 4「系统集成」。
