# 开发计划

## 里程碑

- [x] **M0｜仓库与文档基线** —— 目录结构、`AGENTS.md`、文档骨架、跨设备 Git 基线（SPEC-0001）
- [x] **M1｜需求梳理** —— `docs/overview.md` 范围/非目标 + `docs/specs/*`（SPEC-0002 ~ SPEC-0010）
- [x] **M2｜目标架构设计** —— `docs/architecture.md` 已补目标架构与差异；产出 ADR-0002（Electron → Tauri v2）
- [x] **M3｜技术选型与 `app/` 初始化** —— Tauri v2 工程可运行，IPC、插件/托盘骨架与设置持久化后端已完成（PLAN-0001）
- [x] **M4｜功能重构** —— 阶段 1/2/3/4 已完成；阶段 4「系统集成」Windows 人工验收通过，
      当前仅面向 Windows；D 组自启动、A12/A13 已在 M5 发布产物中通过
      （见 `docs/plans/0002-implementation-phases.md`）
- [x] **M5｜测试与 Windows 打包发布** —— NSIS 与免安装便携 ZIP 已完成最终构建与人工验收；
      三项便携反馈修复、完整便携流程、安装版互斥、便携自启动与发布后状态均通过

## 当前重点

M0-M5 已全部完成，重构阶段结束。当前 Windows 发布产物、便携版与相关 spec 均已验收通过；
`v0.1.1` 已发布，后续日常开发统一在 `develop`，`master` 只用于发版。
新功能或问题按「需求确认 → 新建/更新 SPEC → 实现与验证」的正常开发流程处理，
不再以大阶段重构任务推进。macOS/Linux 仍不在当前范围。

## 后续需求

- [x] **SPEC-0014｜多语言支持** —— `en-US` / `zh-CN`、跟随系统与手动选择、React/Rust
      共享翻译资源；L1-L15 与验收反馈修复均已通过 Windows 人工验收
      （ADR-0012）
- [ ] **SPEC-0015｜GitHub Tag 发布流水线** —— 严格校验 `master` Tag 与四处版本，自动完成
      Windows 构建、`git-cliff` 变更日志和 GitHub Release；`v0.1.1` 已验证单命令入口与
      带 `v` 的资产命名，Release Notes 标题与不再上传 `CHANGES.md` 待下一次正式 Tag
      端到端验收（ADR-0013 · ADR-0014 · ADR-0015）
- [ ] **SPEC-0016｜宣传页（Landing Page）** —— 单页静态站点，信息层级参考
      <https://breaktimer.app/>，计划托管 GitHub Pages 或 Cloudflare Pages；站点目录、
      托管平台、域名、语言、截图素材与许可署名六项待确认
- [ ] **SPEC-0017｜更新检查** —— 设置页手动检查 + 启动后自动检查（默认启用）；发现新版本时
      提示并打开百度 / 夸克网盘下载页，GitHub 仅用于检查；便携版手动覆盖，不做应用内下载安装
      （ADR-0018）。实现与 HTTP/2 panic 修复已完成，待 Windows 人工验收和网盘链接补齐。
- [ ] **SPEC-0018｜装机统计** —— 随机 `installId` 的首次装机事件 + 每日心跳；输出累计/新增/
      活跃装机、装机留存、版本与安装形态分布；默认开启、可关闭，只上报最小匿名字段
      （ADR-0019 · ADR-0020）。客户端与 Worker + D1 已实现，待部署端点并完成 Windows 人工验收。
- [ ] **SPEC-0019｜本地诊断日志** —— 本机滚动日志、Rust panic 与前端未捕获异常记录；
      不上报，不接入装机统计。自动化门禁与安装版启动日志已通过，待 Windows 人工验收。
