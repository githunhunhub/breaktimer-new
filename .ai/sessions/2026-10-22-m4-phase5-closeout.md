# 2026-10-22 M4 阶段 5 收尾与发布产物冒烟

- 关联：PLAN-0002 阶段 5、SPEC-0006、SPEC-0010、SPEC-0011、SPEC-0012、ADR-0008、ADR-0009
- 分支：`codex/m4-phase-5`
- 工作区：`<repo-root>` 普通 checkout
- 状态：代码、自动测试、最终发布构建和便携 ZIP 冒烟完成；用户人工验收第 1-4 项通过，
  第 5-6 项未验证；已清理开发临时产物，等待提交并推送

## 本轮输入

用户在阶段 5 人工验证中发现：

- 点击设置窗口右上角 `X` 会直接退出应用，期望隐藏到托盘继续运行。
- 设置窗口失焦时，点击托盘 `Settings...` 不会重新聚焦。
- 除 NSIS 安装包外，还需要解压即运行的便携 ZIP，配置与运行数据均保存在程序目录。
- 最终人工验证结果：设置关闭/托盘恢复、Theme/Backdrop、NSIS 安装与登录自启动均通过；
  便携 ZIP 完整人工验收与 A12/A13 发布后状态展示尚未验证。

## 实现

- 主窗口关闭统一走 `CloseRequested` 拦截；非 Quit 状态下隐藏，托盘 `Quit` 先标记退出再结束应用。
- 托盘 `Settings...` 与单实例恢复共用 `unminimize -> show -> focus`，并在 100ms 后二次聚焦。
- `Customization` 增加 Theme 与 Backdrop；Theme Reset 同时恢复背景色、文字颜色和遮罩透明度。
- 新增 `AppPaths`：只有可执行文件同目录的普通文件 `portable.flag` 启用便携模式。
- 便携模式设置写入 `data\settings.json`，主窗口与休息窗口共用 `data\webview2\`；目录失败时原生报错退出，不回退 AppData。
- 新增 `pnpm portable:build` 与 `package-portable.ps1`，ZIP 顶层为 `BreakTimer\`，包含 exe、标记和说明文件，不预置 `data\`。
- Tauri bundle 收敛为 NSIS current-user；同时保留与 ZIP 相同的发布版可执行文件。
- 为受 Windows 真实空闲探测影响的 Rust 测试注入 `FakeSystemStateProvider(Active)`。

## 自动验证

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`：3 个测试文件、38 项通过
- `pnpm build`
- `cargo fmt --all --manifest-path app/src-tauri/Cargo.toml -- --check`
- `cargo check --locked --all-targets --manifest-path app/src-tauri/Cargo.toml`
- `cargo test --all-targets --manifest-path app/src-tauri/Cargo.toml`：91 项通过

## 最终发布产物

构建顺序：`pnpm tauri:build` -> `pnpm portable:build` ->
`pnpm tauri bundle --bundles nsis --no-binary-patching`。

| 产物 | 大小 | SHA256 |
| --- | ---: | --- |
| `target/release/breaktimer.exe` | 10,968,064 bytes | `3915BCAB8CBC9B7F801A51383CE3AC4B4E7367F992E1311EFCEE9B129CE391F2` |
| `target/release/bundle/nsis/BreakTimer_0.1.0_x64-setup.exe` | 4,321,502 bytes | `235954913A1D460751016A235049BDA5EFE1828F286C03A1006464BC9536B6F5` |
| `target/release/bundle/portable/BreakTimer_0.1.0_x64-portable.zip` | 5,868,903 bytes | `1058E5FDB01230F5F8574D68FA0088B0CA2DF4C9E05E3ED577FA5C0F1B7A461B` |

- exe `ProductName=BreakTimer`，`ProductVersion=FileVersion=0.1.0`。
- NSIS Authenticode 为 `NotSigned`，SmartScreen 提示是已知非阻断项。
- ZIP 仅包含 `BreakTimer/`、`breaktimer.exe`、`portable.flag` 与 `README.txt`。

## 最终 ZIP 运行冒烟

使用最终 ZIP 在 `bundle/portable/` 下独立解压：

- `get_app_info.settingsPath` 指向解压目录的 `BreakTimer\data\settings.json`。
- 保存 `backdropOpacity=0.65` 后生成本地 `data\settings.json`，WebView2 数据位于
  `data\webview2\EBWebView`。
- 发送设置窗口 `WM_CLOSE` 后进程仍存活、窗口隐藏。
- 启动第二实例后第二进程退出码为 `0`；原窗口恢复可见并获得前台焦点。
- 窗口最小化后再次启动第二实例，原窗口恢复为未最小化、可见且获得前台焦点。
- 结束并重启同一目录后仍读到 `backdropOpacity=0.65`。
- 启动、保存、关闭、恢复和重启期间，AppData 下 BreakTimer 文件无修改。
- 冒烟结束后测试进程为 `0`，临时目录已删除。

## 人工验收结果（2026-10-22）

用户按人工验收清单复验后的结论：

1. 设置窗口 `X` 隐藏后托盘与调度继续工作，托盘 `Quit` 可退出：通过。
2. 隐藏、最小化、失焦三种状态由托盘 `Settings...` 恢复并聚焦：通过。
3. Theme/Reset/Backdrop 与一次 Save 的界面持久化：通过。
4. NSIS 安装、卸载、图标、版本与 D1-D4 登录自启动：通过。
5. 便携 ZIP 完整人工验收、与安装版互斥及便携自启动：未验证。
6. A12/A13 发布后状态展示和真实使用场景：未验证。

因此 SPEC-0007、SPEC-0010、SPEC-0011 可标记 `done`；SPEC-0006 与 SPEC-0012
继续保持 `in-progress`，PLAN-0002 阶段 5 与 roadmap M5 不标记完成。

## 临时产物清理

- 删除 `app/src-tauri/target/release/bundle/portable/` 下开发验收产生的
  `acceptance-*`、`appdata-probe-*`、`final-smoke-*`、`smoke/` 与 `tray-menu.png`。
- 保留正式产物 `BreakTimer_0.1.0_x64-portable.zip`。
- 扫描仓库源码，没有发现待提交的 `tmp`、`temp`、`scratch`、`smoke`、`probe`、日志或备份文件。

## 提交与推送

用户已明确要求提交并推送当前阶段成果：

- 在 `codex/m4-phase-5` 提交阶段 5 源码、测试和文档。
- 以 `--no-ff` 合入 `master` 后推送 `origin/master`。
- 不因提交动作把未验证的便携人工验收、A12/A13、阶段 5 或 M5 标记为完成。
