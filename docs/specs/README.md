# 需求规格（Specs）索引

> 一个需求 = 一个 spec 文件，编号永久、不复用。
> 命名 `NNNN-slug.md`；模板见 [`0000-template.md`](0000-template.md)；流程见根目录 `AGENTS.md` 的「文档工作流」。

## 状态总览

> 「主要实现」只写定位用的短指针；验收记录与未完成项以各 spec 正文为准。
> 需求进度只在本表与 spec 头部同步，不再抄进 `docs/roadmap.md`。

| 编号 | 需求 | 状态 | 关联 | 主要实现 |
| --- | --- | --- | --- | --- |
| [SPEC-0001](0001-cross-device-git-baseline.md) | 跨设备 Git 管理基线 | done | ADR-0001 · ADR-0021 | 根目录仓库配置 |
| [SPEC-0002](0002-break-window-fullscreen-overlay.md) | Popup 休息窗全屏输入阻断（保留可选视觉遮罩） | done | ADR-0002 · ADR-0004 · ADR-0007 | `components/break/`、`windows/` |
| [SPEC-0003](0003-break-scheduling.md) | 休息调度 | done | ADR-0002 · SPEC-0002 | `breaks/`、`flow.rs` |
| [SPEC-0004](0004-working-hours.md) | 工作时段 | done | ADR-0002 · SPEC-0003 | `breaks/`、`working-hours-card.tsx` |
| [SPEC-0005](0005-idle-reset.md) | 闲置重置 | done | ADR-0002 · ADR-0005 · SPEC-0003 | `system_state.rs`、`breaks/` |
| [SPEC-0006](0006-system-tray.md) | 系统托盘 | done | ADR-0002 · ADR-0006 · ADR-0007 · ADR-0010 · SPEC-0003 | `tray/` |
| [SPEC-0007](0007-auto-launch.md) | 自启动 | done | ADR-0002 | `autostart/`、`startup-card.tsx` |
| [SPEC-0008](0008-notification-mode.md) | 通知模式（Notification） | done | ADR-0002 · ADR-0006 · SPEC-0003 | `flow.rs`、`notifications/` |
| [SPEC-0009](0009-sounds.md) | 声音 | done | ADR-0002 · ADR-0003 · SPEC-0002 · SPEC-0008 | `sounds/`、`audio-card.tsx` |
| [SPEC-0010](0010-settings-persistence-and-window.md) | 设置持久化与设置窗口 | done | ADR-0002 | `state/`、`settings-window.tsx` |
| [SPEC-0011](0011-windows-nsis-release.md) | Windows 发布产物（NSIS 与便携 ZIP） | done | ADR-0008 · ADR-0009 · SPEC-0007 · SPEC-0012 | `tauri.conf.json`、发布脚本 |
| [SPEC-0012](0012-portable-zip.md) | Windows 便携 ZIP | done | ADR-0009 · SPEC-0007 · SPEC-0011 | `package-portable.ps1`、`app_paths.rs` |
| [SPEC-0013](0013-app-rename.md) | 应用更名为 BreakTimer-new | done | ADR-0011 · SPEC-0007 · SPEC-0010 · SPEC-0011 · SPEC-0012 | `tauri.conf.json`、`package.json` |
| [SPEC-0014](0014-multilingual-support.md) | 多语言支持 | done | ADR-0012 · PLAN-0003 · SPEC-0002 · SPEC-0006 · SPEC-0008 · SPEC-0010 | `locales/`、`i18n.tsx`、`i18n/` |
| [SPEC-0015](0015-github-tag-release.md) | GitHub Tag 发布流水线 | in-progress | ADR-0013 · ADR-0014 · ADR-0015 · ADR-0017 · PLAN-0004 · SPEC-0011 · SPEC-0012 | `.github/workflows/release.yml`、`release*.ps1` |
| [SPEC-0016](0016-landing-page.md) | 宣传页（Landing Page） | draft | SPEC-0011 · SPEC-0012 · ADR-0011 | 待建（见 spec Q1 / Q2） |
| [SPEC-0017](0017-update-check.md) | 更新检查 | in-progress | ADR-0018 · SPEC-0015 · SPEC-0010 · SPEC-0014 | `updates/`、`updates-card.tsx` |
| [SPEC-0018](0018-installation-metrics.md) | 装机统计 | in-progress | ADR-0019 · ADR-0020 · ADR-0023 · SPEC-0010 · SPEC-0012 · SPEC-0014 · SPEC-0017 | `telemetry/`、`analytics-card.tsx`、`server/metrics/` |
| [SPEC-0019](0019-local-diagnostic-logs.md) | 本地诊断日志 | in-progress | SPEC-0012 · SPEC-0018 | `diagnostics.rs`、`lib/diagnostics.ts` |

<!-- 新增 spec 后在此表追加一行。状态：draft / confirmed / in-progress / done / superseded -->
