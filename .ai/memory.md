# AI 跨会话记忆

> 供后续 AI 会话快速接续上下文。保持精简，只写「稳定且重要」的事实与结论。

## 当前状态

- 项目：BreakTimer 重构（两重目的：学习 AI 编程 + 替换 Electron）
- 阶段：M0-M5 全部完成，重构阶段结束；Windows 发布产物、便携版、三项试用反馈修复与相关人工验收均已完成；后续进入正常的新需求/问题处理流程，当前仍只面向 Windows
- 新代码目录：`app/`（pnpm + Vite + React/TS 前端，`src-tauri/` Rust 后端）
- 旧源码：`breaktimer-app/` 以 git submodule 引用上游，钉在 commit `2d67243`（≈ v2.1.0-54）
- 技术选型：**Tauri v2（Rust）+ 前端保留 React + TypeScript**（ADR-0002）
- 遮挡方案：每显示器一个无边框/透明/置顶/跨工作区窗口；提示条不可聚焦，激活 Popup 休息后切换为可聚焦输入阻断层并用显示器 bounds 铺满，不调用原生全屏（ADR-0004、ADR-0007）；`showBackdrop` 只控制视觉遮罩，`false` 时仍是完整透明覆盖层，应用内只通过 `Cancel Break` 退出
- 声音方案：Rust `rodio` 播放嵌入 WAV，后端在休息开始/结束转换时触发（ADR-0003）
- 系统状态方案：`BreakScheduler` 接收 `SchedulerContext`；`system_state` 提供空闲/锁屏状态，Windows 探测输入桌面；macOS/Linux 分支保留兼容语义但不在当前验收范围（ADR-0005）
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
- M4 阶段 4：托盘最初按 `TraySnapshot` 快照整体重建菜单（1 秒 tick + 状态变更刷新）；2026-10-22 因 Windows 菜单自动关闭/白点已改为稳定根菜单原地更新（ADR-0010）。临时禁用写入并持久化 `disableEndTime` 且到期由 tick 自动恢复、`flow` 按 `notificationType` 分流 Notification 模式（发通知 + 立即续排，不建窗口）、接入官方 autostart 插件（开发构建跳过注册）、设置窗口补 Start at login/Breaks/Menu Bar Text/Audio 分组与提示音试听；原取舍见 ADR-0006
- M4 阶段 4 验证：Rust fmt/check locked all-targets 与 `cargo test --all-targets` 83 tests 通过；前端 lint/typecheck/format/test（24 tests）/build 通过；`pnpm tauri:dev` 运行时冒烟通过（托盘初始化与每秒刷新无错误输出）
- 托盘重要实现细节：菜单与标题调用会 marshal 到主线程并阻塞等待，菜单事件也在主线程刷新托盘；刷新实现先克隆稳定菜单句柄，锁只包住快照比较与记录，原生菜单调用在锁外执行（避免重入等待）
- M4 阶段 4 A8/A9 修复：设置字段改为 `Break type`（`Popup break` / `Notification`）；Popup 激活休息覆盖每个显示器完整 bounds、可聚焦并阻断任务栏/托盘，`Cancel Break` 统一退出；混合 DPI 下先移动再缩放，窗口创建移到工作线程并用全局锁串行化（ADR-0007）
- M4 阶段 4 A8/A9 运行期证据（2026-10-19）：Windows 双屏为副屏 `(-1600,0) 1600×900`、主屏物理 `1920×1200`/DPR 1.25；两个休息页均只有 `Cancel Break`，主/副任务栏与托盘区域命中休息窗；退出后 CDP target 从 3 降至 1，任务栏命中恢复 explorer；Notification 路径未创建休息窗
- M4 阶段 4 设置页签（2026-10-19）：按原版恢复 `General`、`Working Hours`、`Customization`、`System` 四页签；默认 General，共用 draft 与顶部 Save，切页不丢修改
- M4 阶段 4 C3/C4 修正与验收（2026-10-21）：General 顺序改为 `Breaks → Smart Breaks → Snooze → Skip → Advanced`，`Breaks enabled` 放入 Breaks 标题行；`Break type`、`Frequency`、`Length` 标题与控件基线统一，秒字段可完整显示两位数字；Working Hours 使用紧凑的原生 `time` 控件（保留时钟图标），单一时间段不显示删除，`+` 新增行，复制面板可复制到多个星期；复制到已启用星期时时间框会同步刷新；专项人工复验全部通过
- M4 阶段 4 Windows 验收收口（2026-10-21）：C0-C2、C5-C7 人工通过；连同此前结果，A1-A11、A14、B1-B7、C0-C7 均已通过。当时 A12/A13 与 D1-D4 暂缓到 M5 发布产物验证；这些项目后来均已在 M5 通过
- M4 阶段 4 提交：`codex/m4-phase-4` 提交 `9f1881c`，以 `--no-ff` 合入 `master`（merge `995dc64`）并推送 `origin/master`
- M4 阶段 5 收尾（2026-10-22）：设置窗口 `X` 改为隐藏到托盘，托盘 `Settings...` 与单实例共用 `unminimize -> show -> focus` 恢复流程并在 100ms 后二次聚焦；Theme/Backdrop 已纳入 `Customization`；托盘 `Quit` 通过显式退出标记放行关闭
- 便携 ZIP（SPEC-0012）：仅可执行文件同目录的普通文件 `portable.flag` 启用便携模式；设置写入 `data\settings.json`，主窗口与休息窗口共用 `data\webview2\`，目录不可写时原生报错退出且不回退 AppData；`pnpm portable:build` 生成顶层 `BreakTimer\` 的无安装 ZIP
- 阶段 5 最终验证（2026-10-22）：前端 format/lint/typecheck/test（39）/build 通过；Rust fmt/check/test（92）通过；最终 NSIS、发布版 exe 与便携 ZIP 均由同一代代码生成
- 阶段 5 最终产物（2026-10-22）：exe 10,970,112 bytes `F1BF9F969EF4E65E4750B4E9DD1C10E1B2A12862E61DC10E6CC1F34447C39D90`；NSIS 4,375,677 bytes `B126B8419C69E8BEE48E6FC3F24E326B0D6AFB06163CC72D9852B6C276EAEF9D`（NotSigned）；便携 ZIP 5,870,023 bytes `716F56399423276E56851A858A8C8B702ACCBDA32555054A21888D2FEFE1112B`
- 便携反馈修复（2026-10-22）：`idleResetEnabled=false` 时完全忽略 `Idle`，5 分钟调度回归在第 300 秒仍触发；托盘根菜单只绑定一次，倒计时用 `set_text` 原地更新，仅操作布局变化时调整动态项；Theme 整卡随 draft 背景色/文字色预览
- 最终便携 ZIP 冒烟（2026-10-22）：独立解压可直接运行，`get_app_info.settingsPath` 指向解压目录；保存后生成同目录 `data\settings.json` 与 `data\webview2\EBWebView`；`WM_CLOSE` 只隐藏不退出；第二实例恢复隐藏/最小化窗口并获得前台焦点；重启后设置保留；AppData 无文件修改；临时目录和进程已清理
- 阶段 5 人工验收（2026-10-22）：用户最终确认三项便携反馈修复、完整便携流程、同名目录标记、不可写目录失败、安装版互斥、便携自启动、NSIS 隔离、菜单保持与无残影、A12/A13 全部通过；SPEC-0002/0005/0006/0010/0012 均为 `done`，PLAN-0002 阶段 5、PLAN-0002 与 M5 均完成
- 开发临时产物清理（2026-10-22）：已删除 `bundle/portable/` 下的验收临时目录、冒烟目录与截图，仅保留正式便携 ZIP；源码扫描无待提交的临时/调试文件

## 关键约定

- 文档先行，代码是成果（见 `docs/decisions/0001-ai-first-repo-structure.md`）。
- AI 文件不得写入 `app/`。
- 文档工作流：一需求一 spec（`docs/specs/NNNN-*.md`），索引在 `docs/specs/README.md`；小需求计划写在 spec 内，大工程才用 `docs/plans/`；流程细则见 `AGENTS.md`。
- 跨设备同步：能仅凭仓库复现的内容全部纳入 Git；只排除密钥、机器本地状态、依赖目录、构建产物与缓存。
- 打包需显式授权：只有用户明确要求“打包”或生成安装包、发布包时才执行；例行验证中的前端 `pnpm build` 不算打包。

## 后续入口

- 当前无重构阶段、验收或发布阻塞；SPEC-0002/0005/0006/0010/0012 均已同步为 `done`。
- 后续新功能或问题按正常开发流程处理：先确认需求，再新建或更新 `docs/specs/`，按风险补测试，
  自动验证与必要人工验收通过后再提交；不再使用 M0-M5 重构阶段作为任务组织方式。
- macOS/Linux 仍不在当前范围；需要支持时应作为独立需求和验收项立项。
