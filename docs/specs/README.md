# 需求规格（Specs）索引

> 一个需求 = 一个 spec 文件，编号永久、不复用。
> 命名 `NNNN-slug.md`；模板见 [`0000-template.md`](0000-template.md)；流程见根目录 `AGENTS.md` 的「文档工作流」。

## 状态总览

| 编号 | 需求 | 状态 | 关联 ADR | 代码 |
| --- | --- | --- | --- | --- |
| [SPEC-0001](0001-cross-device-git-baseline.md) | 跨设备 Git 管理基线 | done | ADR-0001 | 根目录仓库配置 |
| [SPEC-0002](0002-break-window-fullscreen-overlay.md) | 休息窗口全屏遮挡（软遮挡，允许手动结束） | in-progress | ADR-0002 · ADR-0004 | `app/`（阶段 2 实现完成；Windows 人工验收通过，跨平台限制待记录） |
| [SPEC-0003](0003-break-scheduling.md) | 休息调度 | in-progress | ADR-0002 · SPEC-0002 | `app/`（阶段 2/3 完成；托盘相关留阶段 4） |
| [SPEC-0004](0004-working-hours.md) | 工作时段 | done | ADR-0002 · SPEC-0003 | `app/`（阶段 3 实现与自动化验证完成） |
| [SPEC-0005](0005-idle-reset.md) | 闲置重置 | done | ADR-0002 · ADR-0005 · SPEC-0003 | `app/`（阶段 3 实现与自动化验证完成；macOS/Linux 锁屏限制见 ADR-0005） |
| [SPEC-0006](0006-system-tray.md) | 系统托盘 | confirmed | ADR-0002 · SPEC-0003 | `app/`（待实现） |
| [SPEC-0007](0007-auto-launch.md) | 自启动 | confirmed | ADR-0002 | `app/`（待实现） |
| [SPEC-0008](0008-notification-mode.md) | 通知模式（Notification） | confirmed | ADR-0002 · SPEC-0003 | `app/`（待实现） |
| [SPEC-0009](0009-sounds.md) | 声音 | done | ADR-0002 · ADR-0003 · SPEC-0002 · SPEC-0008 | `app/`（阶段 2 实现与 Windows 人工验收完成） |
| [SPEC-0010](0010-settings-persistence-and-window.md) | 设置持久化与设置窗口 | in-progress | ADR-0002 | `app/`（阶段 1 完成：通用设置窗口与保存生命周期；余下分组待补） |

<!-- 新增 spec 后在此表追加一行。状态：draft / confirmed / in-progress / done / superseded -->
