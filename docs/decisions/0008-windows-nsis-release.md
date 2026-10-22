# ADR-0008：Windows 发布采用 NSIS 单安装包

- 状态：已接受
- 日期：2026-10-21
- 决策者：项目作者

## 背景

阶段 5 需要生成可分发的 Windows 发布产物，并用安装后的程序验证登录自启动。
旧版 Electron 应用在 Windows 上只提供 NSIS 安装包；当前 Tauri 配置使用
`targets: "all"`，会在 Windows 上同时尝试生成多个安装格式，但不属于当前
Windows-only 里程碑的发布目标。

## 决策

Windows 发布只生成 NSIS 安装包，同时保留 Tauri 生成的发布版可执行文件。

- 使用现有 `pnpm tauri:build` 作为发布入口，并在 Tauri bundle 配置中显式指定 NSIS；
- 保持产品名 `BreakTimer`、标识 `com.breaktimer.app` 和当前应用版本不变；
- 复用旧版 BreakTimer 图标资源；
- 本轮不实现代码签名，安装包按未签名产物验收；
- 暂不提供 MSI、便携版或自动更新产物。

## 理由

- 与旧版 Windows 交付方式一致，当前只需要一种可安装产物；
- 减少无关构建目标和发布验证分支；
- Tauri 官方 NSIS 目标足以覆盖当前安装、卸载、快捷方式和登录自启动验收；
- 代码签名和 MSI 是独立发布能力，不应混入功能收尾阶段。

## 影响

- 企业环境若强制要求 MSI 或签名安装包，需要后续单独立项；
- 未签名安装包可能触发 Windows SmartScreen 提示，这是本轮已知风险；
- 后续若增加发布格式或签名，应新增 spec，并在需要时以新 ADR 取代本决策。
