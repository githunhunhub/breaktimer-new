# SPEC-0012：Windows 便携 ZIP

- 状态：done
- 实现状态：便携路径、错误处理、统一 WebView2 数据目录、ZIP 脚本与最终发布产物
  自动冒烟已完成；完整便携流程、安装版互斥与便携自启动已通过人工验收
- 日期：2026-10-21
- 关联：ADR-0009 · SPEC-0007 · SPEC-0011

## 背景 / 问题

NSIS 安装包覆盖常规安装场景，但部分用户需要无需安装、解压后直接运行，并且
配置与运行数据都留在程序目录的 Windows 版本。便携版不能读取或写入安装版
AppData 数据，否则删除便携目录后仍会残留状态，也无法随目录整体迁移。

## 需求（做什么）

1. `pnpm portable:build` 在不生成安装包的情况下构建发布版可执行文件，并输出
   `BreakTimer_<version>_x64-portable.zip`。
2. ZIP 顶层目录为 `BreakTimer\`，至少包含：
   - `breaktimer.exe`
   - `portable.flag`
   - `README.txt`
3. 只有 `breaktimer.exe` 同目录存在普通文件 `portable.flag` 时启用便携模式；
   同名目录不算标记文件。
4. 便携模式的数据布局固定为：
   - 设置：`<程序目录>\data\settings.json`
   - WebView2 数据：`<程序目录>\data\webview2\`
5. ZIP 不预置 `data\`；首次成功启动时创建，主窗口和全部休息窗口都使用便携
   WebView2 目录。
6. 便携数据目录无法创建或不可写时，启动阶段显示明确错误并退出；不得回退到
   AppData 或静默继续。
7. 不含 `portable.flag` 的发布版继续使用安装版路径：
   - 设置：`app_config_dir()\settings.json`
   - WebView2 数据：`app_local_data_dir()`
8. 便携版与安装版共用应用标识和单实例身份，互斥运行。
9. 便携版 `Launch at login` 注册当前便携可执行文件；移动目录后由用户重新开关，
   本期不做旧路径自动迁移。
10. 便携 ZIP 和 NSIS 安装包都由同一版本、同一发布版可执行文件生成。

## 验收标准（可测）

- [x] `pnpm portable:build` 成功完成，并生成包含可执行文件、标记文件和说明文件的 ZIP。
- [x] ZIP 解压到任意可写目录后，直接运行 `breaktimer.exe` 可以启动。
- [x] 首次启动创建 `data\`，保存设置后 `data\settings.json` 出现，WebView2 数据位于
  `data\webview2\`。
- [x] 便携版启动与保存设置不会读取或写入 `%APPDATA%`、`%LOCALAPPDATA%` 下的 BreakTimer 数据。
- [x] 将 `portable.flag` 替换为同名目录后，发布版按安装版路径启动。
- [x] 将标记文件放入不可写目录时，应用显示明确错误并退出，不创建 AppData 回退数据。
- [x] 便携版与安装版不能同时运行；第二个实例只恢复第一个实例的设置窗口。
- [x] 便携版开启 `Launch at login` 后，注册项指向当前解压目录中的可执行文件。
- [x] 便携 ZIP 不影响 NSIS 安装包的生成、安装、卸载和安装版数据路径。

## 非目标 / 边界

- 不实现 MSI、自动更新、代码签名或公证。
- 不内置固定版本 Microsoft Edge WebView2 Runtime。
- 不为移动后的便携目录自动修复自启动注册。
- 不迁移安装版 AppData 数据到便携目录，或反向迁移。

## 设计要点（可选）

- 在启动早期解析路径，再把统一的 `AppPaths` 托管给 Tauri 状态。
- 通过 `WebviewWindowBuilder::data_directory()` 显式设置主窗口和休息窗口的数据目录。
- 可写性检查使用实际临时文件探针，创建失败视为便携模式不可用。
- ZIP 由 `app/scripts/package-portable.ps1` 生成，不把构建产物写入 Git。

## 最终发布产物自动冒烟（2026-10-22）

使用最终 `BreakTimer_0.1.0_x64-portable.zip` 解压到
`bundle/portable/` 下的独立临时目录后完成以下验证：

- 发布版 `breaktimer.exe` 可直接启动；`get_app_info` 返回的 `settingsPath`
  位于解压目录的 `Breaktimer\data\settings.json`，不是 AppData。
- 保存设置后生成 `data\settings.json`，值为 `backdropOpacity = 0.65`；
  WebView2 数据位于 `data\webview2\EBWebView`。
- 向设置窗口发送 `WM_CLOSE` 后进程仍存活、窗口不可见，验证 `X` 走隐藏到托盘路径。
- 启动第二个同目录实例后，第二个进程以退出码 `0` 结束；原窗口从隐藏状态恢复，
  `IsWindowVisible = true` 且获得前台焦点。
- 将原窗口最小化后再次启动第二实例，窗口恢复为未最小化、可见并在前台。
- 结束进程并重新启动同一便携目录后，`backdropOpacity` 仍为 `0.65`，验证同目录数据可跨重启保留。
- 整个启动、保存、关闭、恢复与重启期间，`%APPDATA%\com.breaktimer.app` 和
  `%LOCALAPPDATA%\com.breaktimer.app` 下没有文件时间被修改。
- 冒烟结束后已确认测试进程为 `0`，并删除独立临时目录。

## 实现计划

- [x] 实现可单测的便携路径解析、标记文件判断、目录创建与可写性检查。
- [x] 启动时手动创建主窗口并为所有 WebView 窗口指定统一数据目录。
- [x] 为便携目录失败提供原生错误对话框和无副作用退出。
- [x] 增加 `portable:build` 脚本与便携 README，生成固定结构的 ZIP。
- [x] 运行前端、Rust、NSIS 与便携 ZIP 构建，并完成最终 ZIP 自动冒烟。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-21 | 创建并确认；选择标记文件检测、同目录 `data` 布局、不可写即失败，并保留安装版路径 |
| 2026-10-22 | 进入实现收口：`AppPaths`、便携错误对话框、主窗口显式创建、统一 WebView2 目录与 ZIP 打包脚本完成；等待最终产物和人工验收 |
| 2026-10-22 | 最终便携 ZIP 自动冒烟通过：同目录设置/WebView2 数据、关闭隐藏、第二实例恢复聚焦、跨重启保留和 AppData 隔离均有运行期证据；等待完整人工验收 |
| 2026-10-22 | 用户确认 NSIS、自启动、设置窗口与 Theme/Backdrop 验收通过；便携 ZIP 人工验收项尚未执行，安装版互斥、便携自启动、目录移动和异常标记场景继续保持未完成 |
| 2026-10-22 | 用户确认便携 ZIP 完整流程、同名目录标记、不可写目录失败、安装版互斥、便携自启动与 NSIS 隔离全部通过；SPEC 标记 `done` |
| 2026-10-22 | 应用身份与便携目录名由 SPEC-0013 / ADR-0011 更新；上方旧 ZIP 路径和验证记录保留为历史事实，新 ZIP 需在后续明确授权打包后生成 |
