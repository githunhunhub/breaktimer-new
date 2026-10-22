# SPEC-0011：Windows 发布产物（NSIS 与便携 ZIP）

- 状态：done
- 实现状态：NSIS 配置、便携 ZIP 脚本、最终发布构建与产物记录已完成；NSIS 安装/卸载、
  图标、版本与登录自启动已人工验收通过；便携 ZIP 自动冒烟通过
- 日期：2026-10-21
- 关联：ADR-0008 · ADR-0009 · PLAN-0002 · SPEC-0007 · SPEC-0012

## 背景 / 问题

M4 已完成 Windows 功能重构，但此前只验证开发构建。阶段 5 需要生成可安装的
Windows 发布产物，并让登录自启动、发布后托盘状态和安装流程能在真实发布路径上验收。

## 需求（做什么）

1. Windows 发布生成 NSIS 安装包、Tauri 发布版可执行文件和便携 ZIP。
2. 保持产品名 `BreakTimer`、应用标识 `com.breaktimer.app` 与当前版本号，不引入新的
   安装身份或自动更新机制。
3. 安装器、开始菜单、主窗口和托盘使用旧版 BreakTimer 图标资源。
4. `pnpm tauri:build` 在仓库的 Windows 开发环境中成功完成，并给出明确的安装包和
   可执行文件路径。
5. 安装后的应用可以正常启动、退出和卸载；登录自启动注册指向安装后的发布版可执行文件。
6. 便携 ZIP 的结构、数据目录与运行约束遵循 SPEC-0012。

## 验收标准（可测）

- [x] `pnpm tauri:build` 成功结束，并生成 NSIS 安装包与发布版 `breaktimer.exe`。
- [x] `pnpm portable:build` 成功结束，并生成可直接解压运行的便携 ZIP。
- [x] 构建产物中不再生成 MSI、AppImage、DMG 等当前 Windows-only 范围外的安装格式。
- [x] NSIS 安装包可以完成安装和卸载；安装目录中的 `breaktimer.exe` 可以正常启动。
- [x] 安装后的应用显示 BreakTimer 产品名、版本与图标；托盘图标与旧版视觉一致。
- [x] 开启 `Launch at login` 后，Windows 自启动注册项指向安装后的发布版可执行文件。
- [x] 关闭 `Launch at login` 后，对应自启动注册被移除。
- [x] 便携 ZIP 解压后可按 SPEC-0012 独立运行，且不读取或写入 AppData 中的 BreakTimer 数据。
- [x] 未签名安装包的 SmartScreen 行为已记录，不作为本轮阻断项。

## 非目标 / 边界

- 不实现代码签名、公证、自动更新或 MSI。
- 不改变应用标识、安装版设置存储路径、单实例机制或安装模式。
- 不把开发构建或未安装的裸 `target/release/breaktimer.exe` 结果当作登录自启动验收通过。
- macOS/Linux 发布不在当前里程碑范围内。
- 便携模式的数据路径与限制见 SPEC-0012；安装版路径不因便携版改变。

## 设计要点（可选）

- 在 `app/src-tauri/tauri.conf.json` 把 bundle target 显式收敛为 `nsis`。
- 继续使用 `app/src-tauri/icons/` 中由旧版 artwork 生成的图标集；若构建产物显示错误，
  再从旧版 `icon.png` 或 `icon.ico` 重新生成并纳入版本库。
- 安装包预期位于 `app/src-tauri/target/release/bundle/nsis/`，发布版可执行文件预期位于
  `app/src-tauri/target/release/breaktimer.exe`。
- 便携 ZIP 预期位于
  `app/src-tauri/target/release/bundle/portable/BreakTimer_<version>_x64-portable.zip`。
- 登录自启动的注册路径验收与 SPEC-0007 共用，不在两处维护不同的验收结论。

## 最终发布产物（2026-10-22）

最终构建顺序：

1. `pnpm tauri:build`
2. `pnpm portable:build`
3. `pnpm tauri bundle --bundles nsis --no-binary-patching`

| 产物 | 大小 | SHA256 |
| --- | ---: | --- |
| `app/src-tauri/target/release/breaktimer.exe` | 10,968,064 bytes | `3915BCAB8CBC9B7F801A51383CE3AC4B4E7367F992E1311EFCEE9B129CE391F2` |
| `app/src-tauri/target/release/bundle/nsis/BreakTimer_0.1.0_x64-setup.exe` | 4,321,502 bytes | `235954913A1D460751016A235049BDA5EFE1828F286C03A1006464BC9536B6F5` |
| `app/src-tauri/target/release/bundle/portable/BreakTimer_0.1.0_x64-portable.zip` | 5,868,903 bytes | `1058E5FDB01230F5F8574D68FA0088B0CA2DF4C9E05E3ED577FA5C0F1B7A461B` |

- 发布版 `ProductName` 为 `BreakTimer`，`ProductVersion` 与 `FileVersion` 均为 `0.1.0`。
- NSIS 安装包 Authenticode 状态为 `NotSigned`，SmartScreen 可能提示；这是当前已知非阻断项。
- 最终 ZIP 仅包含 `BreakTimer/`、`breaktimer.exe`、`portable.flag` 与 `README.txt`，
  不包含 `data/`。
- 最终 ZIP 的真实解压运行结果见 SPEC-0012。

## 实现计划

- [x] 收敛 Tauri bundle 配置并补充安装器元数据。
- [x] 验证现有图标资源与旧版视觉一致，构建后检查安装器和托盘图标。
- [x] 执行完整前端、Rust 与 Tauri 发布构建检查。
- [x] 实现便携 ZIP 打包脚本，并从同一发布版可执行文件生成 NSIS 与 ZIP。
- [x] 记录两种产物路径、大小与哈希，提供 Windows 安装、便携运行和登录自启动人工验收清单。
- [x] 更新已通过的 SPEC-0007、SPEC-0011 与相关计划状态；SPEC-0012 保留未通过的便携人工验收项。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-21 | 创建并确认；Windows 发布收敛为 NSIS，单目标见 ADR-0008 |
| 2026-10-21 | 人工验收追加免安装 ZIP 需求；ADR-0009 仅取代 ADR-0008 的便携版边界，NSIS 与发布身份保持不变 |
| 2026-10-22 | NSIS current-user 配置与便携 ZIP 构建入口完成；待最终发布构建、产物哈希和人工安装/自启动验收 |
| 2026-10-22 | 最终 NSIS 与便携 ZIP 构建完成并记录大小/哈希；便携 ZIP 解压运行冒烟通过；等待安装/卸载、自启动与发布后状态人工验收 |
| 2026-10-22 | 用户人工验收通过 NSIS 安装/卸载、产品名、版本、安装器/托盘图标与 D1-D4 登录自启动；便携 ZIP 的自动运行与 AppData 隔离冒烟继续作为发布产物证据，完整便携人工验收仍由 SPEC-0012 跟踪 |
