# 2026-10-23 develop 分支与发布后修复

- 状态：人工验收通过，随本轮修复提交并推送 `develop`
- 关联：ADR-0015 · SPEC-0010 · SPEC-0013 · SPEC-0015 · PLAN-0004

## 需求

- `v0.1.0` 发布后，日常开发全部切换到 `develop`，`master` 只用于发版。
- GitHub Release 资产文件名使用 `BreakTimer-new_vX.Y.Z_x64-*`。
- 保存非休息频率设置时不得重置当前休息倒计时。

## 分支

- 从带 `v0.1.0` Tag 的 `master` 创建本地 `develop`。
- 本轮开始时已有的未提交内容已提交为 `6999c91 feat: 增加单命令发布入口`。
- 新增 ADR-0015，明确 `develop` 日常开发、`master` 发版的边界。

## 实现

- `release-version.mjs` 新增 `asset-name` 命令，统一生成带 `v` 的 NSIS 与便携 ZIP 文件名；
  `package-portable.ps1` 与 Release Workflow 共用该命令。
- `SettingsEffects` 只在休息频率或启停状态变化时请求调度重启。修改长度、声音、文案等字段
  保存后保留当前 `next_break_at`；临时禁用到期恢复仍会建立新倒计时。
- 更新分支、发布和设置规格文档，并在 `AGENTS.md` 固化分支边界。

## 验证

- 先执行失败测试确认：发布资产命令原先缺少 `asset-name`；保存 `breakLengthSeconds` 后
  `next_break_at` 被错误延后 30 秒。
- 前端 format/lint/typecheck/test（72）/build 通过。
- Rust fmt/check 与 test（108）通过。
- `package-portable.ps1` PowerShell 语法检查通过；Workflow 通过 Prettier YAML 格式检查。
- 发布文件名命令输出：
  `BreakTimer-new_v0.1.0_x64-setup.exe` 与
  `BreakTimer-new_v0.1.0_x64-portable.zip`。
- 2026-10-23：用户确认设置倒计时修复与其他改动验收通过。

## 未执行

- 未运行 `pnpm release`、未打包、未创建 Tag。
- 未在下一版正式 GitHub Release 中端到端验证带 `v` 的资产名。
