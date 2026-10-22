# SPEC-0013：应用更名为 BreakTimer-new

- 状态：done
- 日期：2026-10-22
- 关联：ADR-0011 · SPEC-0007 · SPEC-0010 · SPEC-0011 · SPEC-0012

## 背景 / 问题

当前实现仍沿用上游产品的 `BreakTimer` 名称和 `com.breaktimer.app` 应用标识。
本项目已经与旧版 Electron 实现完全拆分，是一个独立的新项目，不应继续复用旧产品
身份，也不需要考虑旧应用的升级、数据迁移或注册项清理。

## 需求（做什么）

1. 用户可见产品名统一为 `BreakTimer-new`，包括 Tauri 产品名、主窗口与休息窗口
   标题、托盘提示、About、设置页自启动说明、便携说明和启动错误对话框。
2. 技术标识与文件名使用小写 `breaktimer-new`：
   - npm 包名：`breaktimer-new`
   - Cargo package：`breaktimer-new`
   - Windows 可执行文件：`breaktimer-new.exe`
   - Rust library crate：`breaktimer_new_lib`
3. Tauri identifier 改为 `com.githunhunhub.breaktimernew`。
4. 新 identifier 形成独立的安装、配置、缓存、WebView2 数据、通知、单实例、
   自启动和卸载身份；不迁移、不清理旧 `com.breaktimer.app` 身份的数据或注册项。
5. 便携 ZIP 的顶层目录改为 `BreakTimer-new\`，ZIP 名改为
   `BreakTimer-new_<version>_x64-portable.zip`，内部可执行文件为
   `breaktimer-new.exe`。
6. About 明确区分当前项目源码和上游 BreakTimer，不再把当前项目指向旧产品官网。
7. `breaktimer-app/` 子模块路径、上游 URL、固定提交和历史文档中的既有记录保持不变。

## 验收标准（可测）

- [x] `app/src-tauri/tauri.conf.json` 的产品名为 `BreakTimer-new`，identifier 为
  `com.githunhunhub.breaktimernew`，主窗口标题为 `BreakTimer-new`。
- [x] npm、Cargo、Rust library、可执行文件入口和 Cargo lockfile 使用本 spec
  约定的名称，项目能够正常构建与运行。
- [x] Windows 开发构建的进程与可执行文件名为 `breaktimer-new.exe`。
- [x] 运行后使用 `%APPDATA%\com.githunhunhub.breaktimernew` 和
  `%LOCALAPPDATA%\com.githunhunhub.breaktimernew`；旧 `com.breaktimer.app`
  数据目录内容与文件时间不变。
- [x] 主窗口、休息窗口、托盘提示、About 和设置页自启动说明均显示
  `BreakTimer-new`。
- [x] About 同时给出当前项目源码与上游 BreakTimer 来源，不伪造新官网。
- [x] 便携脚本与说明文件中的顶层目录、ZIP 名和可执行文件名全部改为新名称。
- [x] `pnpm format:check`、`lint`、`typecheck`、`test`、`build` 以及 Rust
  `fmt --check`、`check --locked --all-targets`、`test --all-targets` 全部通过。

## 非目标 / 边界

- 不兼容或升级旧 `BreakTimer` 安装，不迁移设置、WebView2 数据或单实例状态。
- 不删除旧应用的数据目录、自启动注册、通知记录或卸载信息。
- 不修改 `app/` 目录名、Gitee remote、旧源码子模块路径及其上游 URL。
- 不把 `https://breaktimer.app` 当作本项目官网，也不新增虚构项目官网。
- 本轮未获打包授权，不生成 NSIS 或便携 ZIP；只完成源码、配置与脚本命名。
- 图标、版本、安装模式、签名与发布格式沿用现有决策，不因更名重做。

## 设计要点（可选）

- 后端使用单一产品名常量，避免窗口、托盘、About 和错误对话框分别硬编码。
- 产品展示名与机器标识分层：展示名使用 `BreakTimer-new`，路径与可执行文件使用
  `breaktimer-new`，identifier 使用 `com.githunhunhub.breaktimernew`。
- 新 identity 自然产生新数据目录和新系统身份；旧 identity 不做兼容桥接。

## 实现计划

- [x] 创建本 spec 与 ADR-0011，并更新 spec 索引和当前产品说明。
- [x] 先补启动项文案测试并确认旧实现失败。
- [x] 修改 Tauri、npm、Cargo、Rust 入口和用户可见名称。
- [x] 修改便携打包脚本、便携说明与既有测试夹具。
- [x] 执行完整自动化验证和 Windows 运行时冒烟。
- [x] 提供人工验收清单；验收通过后将本 spec 标记为 `done` 并更新 AI 记忆。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-22 | 用户确认更名方案并开始实现；确定产品名、技术标识和新 identifier |
| 2026-10-22 | 完整自动化验证与 Windows 运行时冒烟通过；用户人工验收通过，状态改为 `done` |
