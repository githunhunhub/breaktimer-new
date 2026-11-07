# 项目概览

## 目标

1. **学习 AI 编程**：把本次重构当作「如何更好地用 AI 完成项目开发」的实践，关键技术结论按文档工作流沉淀到 `docs/`。
2. **重写 BreakTimer**：用 Tauri v2（Rust）实现独立的 `BreakTimer-new`，
   替换原项目的 Electron（见 ADR-0002、ADR-0011）。

## 范围（In scope）

复刻旧版 BreakTimer 的核心能力（前端保留 React + TypeScript）：

- 休息调度：定时休息、工作时段、闲置重置、休眠/锁屏恢复、推迟/跳过/立即休息。
- 休息呈现：Popup 模式在每个显示器显示全屏输入阻断覆盖层（含任务栏/托盘区域），视觉遮罩可开关；
  Notification 模式只发系统通知；支持声音。
- 系统托盘：菜单、倒计时/距上次休息文本、立即休息、开关休息。
- 设置持久化与设置窗口。
- 多语言支持：首版英语与简体中文，默认跟随系统，可在设置中选择；共享翻译资源支持后续
  按文件新增语言（SPEC-0014）。
- 更新检查：设置页手动检查、启动后自动检查（默认启用）；发现新版本时提示并打开 GitHub
  Release 或网盘下载页；不包含应用内自动下载与安装（SPEC-0017、ADR-0018）。
- 装机统计：匿名 `installId` 的首次装机与每日心跳，用 EdgeOne KV 中的 HLL 草图输出
  M1～M8（日/月活跃、日/月各版本活跃、日/月新增、累计与各版本装机）的近似趋势；
  不保存逐装机明细，默认开启、可关闭，只上报白名单字段（SPEC-0018、ADR-0019、ADR-0023）。
- 本地诊断日志：运行错误、Rust panic 与前端未捕获异常只写入本机滚动日志，不上报
  （SPEC-0019）。
- 系统通知（`Notification` 模式）。
- 自启动（auto-launch）。
- 独立的 `BreakTimer-new` 产品名与 `com.githunhunhub.breaktimernew` 应用身份。
- 对外宣传页：纯静态、中英双语，托管于 GitHub Pages；只描述已实现能力（SPEC-0016、ADR-0024）。
- 当前验收与发布平台：Windows（x64）；macOS/Linux 暂不纳入当前里程碑。

## 非目标（Out of scope）

- 应用内自动下载与安装更新（旧版 Snap/AppImage 的自动更新不迁移；Tauri updater 的评估
  另立需求，本轮只做更新检查，见 SPEC-0017）。
- 企业/商业部署支持。
- kiosk 级「硬锁定」：独占系统键盘鼠标、禁止 Alt+Tab/Windows 键/任务管理器（本期只做应用层输入阻断，
  见 ADR-0002、ADR-0007）。
- macOS/Linux 的发布、平台差异与运行验收；相关兼容代码可保留，但不作为当前里程碑的完成条件。

## 约束

- 当前平台：Windows；macOS/Linux 后续需要时再单独立项验收。
- 前端尽量复用旧 UI 资产（React + TypeScript）
- 技术栈：以 `docs/architecture.md` 与 `docs/decisions/0002-technology-stack.md` 为准
- 旧实现仅作参考：`breaktimer-app/`
- 不迁移、清理或兼容旧 `BreakTimer` 的数据、自启动和安装身份。
