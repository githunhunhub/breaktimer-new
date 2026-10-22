# 2026-10-22 应用更名为 BreakTimer-new

## 背景

- 用户确认新项目不再沿用旧 Electron 应用的产品身份，也不需要升级、迁移或清理旧应用。
- 产品展示名使用 `BreakTimer-new`；技术包名与可执行文件使用小写
  `breaktimer-new`；Tauri identifier 使用 `com.githunhunhub.breaktimernew`。

## 变更

- 新增 SPEC-0013 与 ADR-0011，更新 overview、glossary、spec 索引及既有发布 spec
  的历史说明。
- 更新 Tauri 产品名、identifier、主窗口标题、npm/Cargo 包名、Rust library 与入口。
- 后端以 `PRODUCT_NAME` 常量统一托盘、窗口、About 和便携目录错误对话框的产品名。
- 更新自启动说明、About 来源、便携脚本、便携 README 与测试夹具。
- 保留 `app/` 目录、Gitee remote、`breaktimer-app/` 子模块及其上游 URL。
- 未执行 Tauri bundle、NSIS 或便携 ZIP 打包。

## 验证

- 前端：`pnpm format:check`、`lint`、`typecheck`、`test`（40）、`build` 全部通过。
- Rust：`cargo fmt --check`、`check --locked --all-targets`、`test --all-targets`
  （93）全部通过。
- Windows 运行时：进程为 `target\debug\breaktimer-new.exe`，窗口标题与
  `get_app_info.name` 为 `BreakTimer-new`，新 identity 的 Roaming/LocalAppData
  目录正常生成，单实例、设置保存和重启恢复通过。
- 旧 `com.breaktimer.app` 的 Roaming/LocalAppData 内容与文件时间保持不变。
- 2026-10-22 用户人工验收通过；SPEC-0013 标记为 `done`。

## 交付

- 用户明确要求提交并推送本轮更名内容至 `origin/master`。
