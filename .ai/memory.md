# AI 跨会话记忆

> 供后续 AI 会话快速接续上下文。保持精简，只写「稳定且重要」的事实与结论。

## 当前状态

- 项目：BreakTimer 重构（两重目的：学习 AI 编程 + 替换 Electron）
- 阶段：M0/M1/M2/M3 完成；M4 阶段 1/2/3 已完成；阶段 4「系统集成」A1-A11、A14、B 组通知模式与 C3/C4 设置布局已人工通过；D 组留到发布打包阶段
- 新代码目录：`app/`（pnpm + Vite + React/TS 前端，`src-tauri/` Rust 后端）
- 旧源码：`breaktimer-app/` 以 git submodule 引用上游，钉在 commit `2d67243`（≈ v2.1.0-54）
- AI 学习笔记目录：`ai-notes/`
- 技术选型：**Tauri v2（Rust）+ 前端保留 React + TypeScript**（ADR-0002）
- 遮挡方案：每显示器一个无边框/透明/置顶/跨工作区窗口；提示条不可聚焦，激活 Popup 休息后切换为可聚焦输入阻断层并用显示器 bounds 铺满，不调用原生全屏（ADR-0004、ADR-0007）；`showBackdrop` 只控制视觉遮罩，`false` 时仍是完整透明覆盖层，应用内只通过 `Cancel Break` 退出
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
- M4 阶段 3 提交：`codex/m4-phase-3` 提交 `82f2db3`，以 `--no-ff` 合入 `master`（merge `541158c`）并推送 `origin/master`
- M4 阶段 4：托盘按 `TraySnapshot` 快照整体重建菜单（1 秒 tick + 状态变更刷新）、临时禁用写入并持久化 `disableEndTime` 且到期由 tick 自动恢复、`flow` 按 `notificationType` 分流 Notification 模式（发通知 + 立即续排，不建窗口）、接入官方 autostart 插件（开发构建跳过注册）、设置窗口补 Start at login/Breaks/Menu Bar Text/Audio 分组与提示音试听；取舍见 ADR-0006
- M4 阶段 4 验证：Rust fmt/check locked all-targets 与 `cargo test --all-targets` 83 tests 通过；前端 lint/typecheck/format/test（24 tests）/build 通过；`pnpm tauri:dev` 运行时冒烟通过（托盘初始化与每秒刷新无错误输出）
- M4 阶段 4 重要实现细节：`TrayIcon::set_menu`/`set_title` 会 marshal 到主线程并阻塞等待，菜单事件也在主线程刷新托盘；因此刷新实现用 `app.tray_by_id` 取句柄，锁只包住快照比较与记录，不在持锁期间调用托盘 API（避免重入等待）
- M4 阶段 4 A8/A9 修复：设置字段改为 `Break type`（`Popup break` / `Notification`）；Popup 激活休息覆盖每个显示器完整 bounds、可聚焦并阻断任务栏/托盘，`Cancel Break` 统一退出；混合 DPI 下先移动再缩放，窗口创建移到工作线程并用全局锁串行化（ADR-0007）
- M4 阶段 4 A8/A9 运行期证据（2026-10-19）：Windows 双屏为副屏 `(-1600,0) 1600×900`、主屏物理 `1920×1200`/DPR 1.25；两个休息页均只有 `Cancel Break`，主/副任务栏与托盘区域命中休息窗；退出后 CDP target 从 3 降至 1，任务栏命中恢复 explorer；Notification 路径未创建休息窗
- M4 阶段 4 设置页签（2026-10-19）：按原版恢复 `General`、`Working Hours`、`Customization`、`System` 四页签；默认 General，共用 draft 与顶部 Save，切页不丢修改
- M4 阶段 4 C3/C4 修正与验收（2026-10-21）：General 顺序改为 `Breaks → Smart Breaks → Snooze → Skip → Advanced`，`Breaks enabled` 放入 Breaks 标题行；`Break type`、`Frequency`、`Length` 标题与控件基线统一，秒字段可完整显示两位数字；Working Hours 使用紧凑的原生 `time` 控件（保留时钟图标），单一时间段不显示删除，`+` 新增行，复制面板可复制到多个星期；复制到已启用星期时时间框会同步刷新；专项人工复验全部通过

## 关键约定

- 文档先行，代码是成果（见 `docs/decisions/0001-ai-first-repo-structure.md`）。
- AI 文件不得写入 `app/`。
- 文档工作流：一需求一 spec（`docs/specs/NNNN-*.md`），索引在 `docs/specs/README.md`；小需求计划写在 spec 内，大工程才用 `docs/plans/`；流程细则见 `AGENTS.md`。
- 跨设备同步：能仅凭仓库复现的内容全部纳入 Git；只排除密钥、机器本地状态、依赖目录、构建产物与缓存。

## 待办 / 阻塞

- SPEC-0010 当前为 `in-progress`：四页签与 C3 General/Working Hours 修正已完成，C3/C4 专项人工复验通过；继续验收 C0-C2、C5-C7；Theme、遮罩颜色/透明度留阶段 5。
- SPEC-0002：A8/A9/A14 已在 Windows 人工通过；继续验证 `showBackdrop=false`、推迟/跳过、混合 DPI 与 macOS/Linux 平台限制。
- SPEC-0009：播放通道、资源映射与 Windows 真实音频人工验收已完成，状态 `done`。
- SPEC-0006/0007/0008 当前均为 `in-progress`：A1-A11、A14 与 B 组已人工通过；A12/A13、C 组剩余项与 D 组仍需人工验收后才改 `done`。
- SPEC-0003：阶段 2/3/4 核心完成（含托盘相关项），待运行期验收。
- 按 `docs/plans/0002-implementation-phases.md` 继续：阶段 4 人工验收 → 阶段 5「设置补全与打包发布」。
