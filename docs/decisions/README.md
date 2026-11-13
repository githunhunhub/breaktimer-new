# 决策记录（ADR）索引

> ADR 只增不改：编号按创建顺序递增，不复用；被推翻时新增一条并用「取代 / 部分取代」引用旧记录。
> 找「为什么这样选」先查本表，再打开对应文件。状态列统一用中文，历史文件里的 `accepted`
> 等价于「已接受」。模板见 [`0000-template.md`](0000-template.md)。

| 编号 | 决策 | 状态 | 关联 |
| --- | --- | --- | --- |
| [ADR-0001](0001-ai-first-repo-structure.md) | AI 优先的仓库结构（文档即源码） | 已接受 | SPEC-0001 · 部分被 ADR-0021 取代 |
| [ADR-0002](0002-technology-stack.md) | 技术栈：Electron → Tauri v2（Rust），前端保留 React + TypeScript | 已接受 | SPEC-0002 ~ SPEC-0010 |
| [ADR-0003](0003-rust-side-sound-playback.md) | 声音由 Rust 侧播放 | 已接受 | SPEC-0009 |
| [ADR-0004](0004-backdrop-sized-to-monitor-bounds.md) | 遮挡层铺满显示器边界而非原生全屏 | 已接受 | SPEC-0002 |
| [ADR-0005](0005-system-state-provider.md) | 系统空闲与锁屏状态采集 | 已接受 | SPEC-0003 · SPEC-0005 |
| [ADR-0006](0006-system-integration.md) | 系统集成阶段的托盘刷新与通知生命周期 | 已接受 | SPEC-0006 ~ SPEC-0008 |
| [ADR-0007](0007-popup-break-input-blocking-overlay.md) | Popup 休息阶段使用可聚焦的输入阻断覆盖层 | 已接受 | SPEC-0002 · SPEC-0006 |
| [ADR-0008](0008-windows-nsis-release.md) | Windows 发布采用 NSIS 单安装包 | 已接受 | SPEC-0011 |
| [ADR-0009](0009-windows-portable-zip.md) | Windows 同时提供 NSIS 安装包与便携 ZIP | 已接受 | SPEC-0011 · SPEC-0012 |
| [ADR-0010](0010-tray-menu-in-place-updates.md) | 托盘菜单原地更新 | 已接受 | SPEC-0006 · ADR-0006 |
| [ADR-0011](0011-app-identity-rename.md) | 采用独立的 BreakTimer-new 应用身份 | 已接受 | SPEC-0013 · SPEC-0016 |
| [ADR-0012](0012-shared-json-i18n.md) | 共享 JSON 翻译资源与轻量消息格式 | 已接受 | SPEC-0014 |
| [ADR-0013](0013-github-tag-release-pipeline.md) | GitHub Tag 发布流水线 | 已接受 | SPEC-0015 |
| [ADR-0014](0014-github-primary-gitee-backup.md) | GitHub 主仓库与 Gitee 纯备份 | 已接受 | SPEC-0015 · 被 ADR-0017 取代 |
| [ADR-0015](0015-develop-development-and-master-release.md) | `develop` 日常开发与 `master` 发版 | 已接受 | SPEC-0015 · ADR-0014 |
| [ADR-0016](0016-ai-memory-and-single-source-of-truth.md) | AI 记忆分级与文档单一事实源 | 已被 ADR-0021 取代 | — |
| [ADR-0017](0017-gitee-decommission.md) | 停用 Gitee 远程，仅保留 GitHub | 已接受 | SPEC-0015 |
| [ADR-0018](0018-update-check-scope.md) | 更新检查「只检查不安装」与 Release 元数据 | 已接受 | SPEC-0017 |
| [ADR-0019](0019-installation-metrics-cloudflare.md) | 装机统计采用自建匿名端点（Cloudflare Worker + D1） | 已接受 | SPEC-0018 · SPEC-0012 |
| [ADR-0020](0020-telemetry-without-startup-notice.md) | 装机统计不发送启动告知通知 | 已接受 | SPEC-0018 · 部分取代 ADR-0019 |
| [ADR-0021](0021-retire-ai-process-directory.md) | 退出 `.ai` 私有过程目录 | 已接受 | SPEC-0001 · 取代 ADR-0016 |
| [ADR-0022](0022-ai-context-index-and-dedupe.md) | AI 上下文索引化与去重复 | 已接受 | `AGENTS.md` · `docs/architecture.md` |
| [ADR-0023](0023-installation-metrics-edgeone-kv-hll.md) | 装机统计改用 EdgeOne KV + HLL 近似聚合 | 已接受 | SPEC-0018 · 部分取代 ADR-0019 |
| [ADR-0024](0024-landing-page-static-github-pages.md) | 宣传页采用仓库内静态站点与 GitHub Pages | 已接受 | SPEC-0016 |
| [ADR-0025](0025-landing-page-netdisk-downloads.md) | 宣传页下载入口改用 Release 网盘元数据 | 已接受 | SPEC-0016 · SPEC-0017 · 部分取代 ADR-0024 |
| [ADR-0026](0026-gpl-3-0-or-later-license.md) | 项目整体采用 GPL-3.0-or-later 并补齐许可证与署名 | 已接受 | SPEC-0020 · SPEC-0016 · 部分取代 ADR-0024 |
| [ADR-0027](0027-break-card-shape-settings-and-live-refresh.md) | 休息卡形状设置与保存后即时刷新 | 部分被 ADR-0028 取代 | SPEC-0021 · SPEC-0002 · SPEC-0010 · SPEC-0014 · ADR-0004 · ADR-0007 |
| [ADR-0028](0028-break-card-shape-applies-from-next-break.md) | 休息卡形状从下一次休息生效 | 已接受 | SPEC-0021 · SPEC-0002 · SPEC-0010 · SPEC-0014 · ADR-0007 · 部分取代 ADR-0027 |

<!-- 新增 ADR 后在此表追加一行，并保持编号递增。 -->
