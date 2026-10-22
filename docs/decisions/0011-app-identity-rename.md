# ADR-0011：采用独立的 BreakTimer-new 应用身份

- 状态：已接受
- 日期：2026-10-22
- 决策者：项目作者
- 取代范围：ADR-0008 中保持旧产品名与 identifier 的条款；ADR-0009 中便携目录
  和可执行文件沿用 `BreakTimer` / `breaktimer.exe` 的命名条款

## 背景

当前代码已经完成从 Electron 到 Tauri v2 的重写，是独立的新项目。继续使用上游
产品名 `BreakTimer` 和旧 identifier `com.breaktimer.app` 会与旧安装、用户数据和
系统身份混在一起，也无法准确表达两个项目的关系。

用户已明确不需要旧应用升级、数据迁移或兼容，只要求建立新的独立身份。

## 决策

- 用户可见产品名统一为 `BreakTimer-new`。
- npm、Cargo 与 Windows 可执行文件统一使用小写 `breaktimer-new`。
- Rust library crate 使用 `breaktimer_new_lib`。
- Tauri identifier 使用 `com.githunhunhub.breaktimernew`。
- 新 identity 独立生成配置、缓存、WebView2 数据、通知、单实例、自启动和卸载身份。
- 不迁移、不复制、不清理旧 `com.breaktimer.app` 的数据与注册项。
- About 中当前项目源码与上游 BreakTimer 来源分开列出。

## 理由

- 新旧项目在代码实现、维护边界和发布路径上已经完全分离，共享身份只会制造歧义；
- 新 identifier 让两个应用可以独立安装、运行、设置和卸载，符合独立项目定位；
- 产品名保留可读的大小写，技术文件名全部使用小写，兼顾 UI 表达与跨平台工具习惯；
- 不实现迁移层可以减少一次性的兼容代码，并避免意外修改旧应用数据。

## 影响

- 新应用首次运行会创建 `%APPDATA%\com.githunhunhub.breaktimernew` 与
  `%LOCALAPPDATA%\com.githunhunhub.breaktimernew`，不会读取旧应用设置。
- 新旧应用使用不同单实例身份，可以同时运行；旧自启动项若存在也保持原状。
- Windows 发布版可执行文件变为 `breaktimer-new.exe`，未来安装包和便携 ZIP
  的名称随 SPEC-0013 更新。
- ADR-0008 的 NSIS、未签名、current-user 安装等发布决策继续有效；ADR-0009 的
  便携数据布局、标记文件和安装版/便携版共享同一新 identity 的决策继续有效。
- 本轮未获打包授权，因此只修改发布配置和脚本，不生成安装包或便携 ZIP。
