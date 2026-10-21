# 需求规格（Specs）索引

> 一个需求 = 一个 spec 文件，编号永久、不复用。
> 命名 `NNNN-slug.md`；模板见 [`0000-template.md`](0000-template.md)；流程见根目录 `AGENTS.md` 的「文档工作流」。

## 状态总览

| 编号 | 需求 | 状态 | 关联 ADR | 代码 |
| --- | --- | --- | --- | --- |
| [SPEC-0001](0001-cross-device-git-baseline.md) | 跨设备 Git 管理基线 | done | ADR-0001 | 根目录仓库配置 |
| [SPEC-0002](0002-break-window-fullscreen-overlay.md) | Popup 休息窗全屏输入阻断（保留可选视觉遮罩） | in-progress | ADR-0002 · ADR-0004 · ADR-0007 | `app/`（A8/A9/A14 Windows 人工通过；`showBackdrop=false`、推迟/跳过与混合 DPI 待验） |
| [SPEC-0003](0003-break-scheduling.md) | 休息调度 | done | ADR-0002 · SPEC-0002 | `app/`（阶段 2/3/4 完成；Windows 托盘触发与调度续排人工通过） |
| [SPEC-0004](0004-working-hours.md) | 工作时段 | done | ADR-0002 · SPEC-0003 | `app/`（阶段 3 实现与自动化验证完成） |
| [SPEC-0005](0005-idle-reset.md) | 闲置重置 | done | ADR-0002 · ADR-0005 · SPEC-0003 | `app/`（阶段 3 实现与自动化验证完成；macOS/Linux 锁屏限制见 ADR-0005） |
| [SPEC-0006](0006-system-tray.md) | 系统托盘 | in-progress | ADR-0002 · ADR-0006 · SPEC-0003 · ADR-0007 | `app/`（Windows 主流程人工通过；A12/A13 转入 M5 发布后实际使用验证） |
| [SPEC-0007](0007-auto-launch.md) | 自启动 | in-progress | ADR-0002 | `app/`（M4 阶段 4 实现完成；Windows 发布产物与登录自启转入 M5 验证） |
| [SPEC-0008](0008-notification-mode.md) | 通知模式（Notification） | done | ADR-0002 · ADR-0006 · SPEC-0003 | `app/`（`Break type` 入口与 B 组通知模式 Windows 人工验收通过） |
| [SPEC-0009](0009-sounds.md) | 声音 | done | ADR-0002 · ADR-0003 · SPEC-0002 · SPEC-0008 | `app/`（阶段 2 实现与 Windows 人工验收完成） |
| [SPEC-0010](0010-settings-persistence-and-window.md) | 设置持久化与设置窗口 | in-progress | ADR-0002 | `app/`（四页签与 C0-C7 Windows 人工验收通过；Theme/Backdrop 等剩余字段留阶段 5） |

<!-- 新增 spec 后在此表追加一行。状态：draft / confirmed / in-progress / done / superseded -->
