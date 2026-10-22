# 需求规格（Specs）索引

> 一个需求 = 一个 spec 文件，编号永久、不复用。
> 命名 `NNNN-slug.md`；模板见 [`0000-template.md`](0000-template.md)；流程见根目录 `AGENTS.md` 的「文档工作流」。

## 状态总览

| 编号 | 需求 | 状态 | 关联 ADR | 代码 |
| --- | --- | --- | --- | --- |
| [SPEC-0001](0001-cross-device-git-baseline.md) | 跨设备 Git 管理基线 | done | ADR-0001 | 根目录仓库配置 |
| [SPEC-0002](0002-break-window-fullscreen-overlay.md) | Popup 休息窗全屏输入阻断（保留可选视觉遮罩） | done | ADR-0002 · ADR-0004 · ADR-0007 | `app/`（A8/A9/A14、`showBackdrop=false`、推迟/跳过与混合 DPI 均通过 Windows 人工验收） |
| [SPEC-0003](0003-break-scheduling.md) | 休息调度 | done | ADR-0002 · SPEC-0002 | `app/`（阶段 2/3/4 完成；Windows 托盘触发与调度续排人工通过） |
| [SPEC-0004](0004-working-hours.md) | 工作时段 | done | ADR-0002 · SPEC-0003 | `app/`（阶段 3 实现与自动化验证完成） |
| [SPEC-0005](0005-idle-reset.md) | 闲置重置 | done | ADR-0002 · ADR-0005 · SPEC-0003 | `app/`（关闭闲置重置后忽略 `Idle` 的修复、第 300 秒回归与便携版人工验收均通过） |
| [SPEC-0006](0006-system-tray.md) | 系统托盘 | done | ADR-0002 · ADR-0006 · ADR-0007 · ADR-0010 · SPEC-0003 | `app/`（稳定根菜单原地更新、菜单保持、无残影与 A12/A13 均通过 Windows 人工验收） |
| [SPEC-0007](0007-auto-launch.md) | 自启动 | done | ADR-0002 | `app/`（Windows 发布产物 D1-D4 登录自启与注册路径人工验收通过） |
| [SPEC-0008](0008-notification-mode.md) | 通知模式（Notification） | done | ADR-0002 · ADR-0006 · SPEC-0003 | `app/`（`Break type` 入口与 B 组通知模式 Windows 人工验收通过） |
| [SPEC-0009](0009-sounds.md) | 声音 | done | ADR-0002 · ADR-0003 · SPEC-0002 · SPEC-0008 | `app/`（阶段 2 实现与 Windows 人工验收完成） |
| [SPEC-0010](0010-settings-persistence-and-window.md) | 设置持久化与设置窗口 | done | ADR-0002 | `app/`（四页签、Theme 整卡实时预览、关闭隐藏、托盘恢复与 Quit 均通过 Windows 人工验收） |
| [SPEC-0011](0011-windows-nsis-release.md) | Windows 发布产物（NSIS 与便携 ZIP） | done | ADR-0008 · ADR-0009 · SPEC-0007 · SPEC-0012 | `app/src-tauri/tauri.conf.json`、安装包、便携 ZIP 与发布版可执行文件（NSIS 安装/卸载、图标、版本与登录自启人工通过；产物哈希已记录） |
| [SPEC-0012](0012-portable-zip.md) | Windows 便携 ZIP | done | ADR-0009 · SPEC-0007 · SPEC-0011 | `app/scripts/package-portable.ps1`、`app/src-tauri/src/app_paths.rs`（完整便携流程、异常标记、安装版互斥、便携自启动与 NSIS 隔离均通过） |
| [SPEC-0013](0013-app-rename.md) | 应用更名为 BreakTimer-new | done | ADR-0011 · SPEC-0007 · SPEC-0010 · SPEC-0011 · SPEC-0012 | `app/src-tauri/tauri.conf.json`、`app/package.json`、Cargo/Rust 入口、托盘/窗口与服务设置文案、便携脚本（自动化、运行时与 Windows 人工验收均通过） |

<!-- 新增 spec 后在此表追加一行。状态：draft / confirmed / in-progress / done / superseded -->
