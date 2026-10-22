# 2026-10-22 便携版试用反馈修复

- 关联：SPEC-0005、SPEC-0006、SPEC-0010、ADR-0010、PLAN-0002 阶段 5
- 分支：从 `master` 创建 `codex/m5-closeout`，以 `--no-ff` 合回 `master`
- 工作区：`<repo-root>` 普通 checkout
- 状态：三项修复、自动验证、最终发布构建与人工验收全部完成；作为 M5 收口内容提交并推送

## 本轮输入

用户在便携版试用中发现：

1. 点击托盘图标后不操作，菜单数秒后自动关闭，并在左上角留下白点。
2. 关闭闲置重置且 `Breaks` 设为 5 分钟时，到时间不触发休息，`Next break in`
   长期停在约 4 分钟。
3. `Theme` 设置只在控件中显示颜色，`Theme` 分组本身没有随 draft 实时预览。

## 根因与实现

### Breaks 5 分钟不触发

- 根因：Windows 会短暂上报 `Idle`。关闭闲置重置后，旧逻辑仍把 `Idle` 当作暂停信号，
  清空待触发休息；下一次 `Active` 又重排完整频率，导致倒计时反复回到约 4 分钟。
- 实现：`idleResetEnabled=false` 时完全忽略 `Idle`；锁屏暂停逻辑保持独立。
- 回归：连续发送 299 次真实 `Idle { idle_seconds }`，原定第 300 秒仍产生
  `BreakPrompted`，且期间 `next_break_at` 不移位。

### 托盘菜单自动关闭与白点

- 根因：倒计时分钟文案变化触发 `TrayIcon::set_menu`，替换 Windows 正在显示的
  原生 `HMENU`，导致菜单关闭并留下视觉残影。
- 实现：根菜单只在初始化时绑定一次；倒计时和禁用时长通过稳定菜单项 `set_text`
  原地更新；只有可用操作变化时才原地移除/插入动态项（ADR-0010）。
- 回归：两个仅倒计时文案不同的 Working 快照，`TrayMenuLayout` 必须相等。

### Theme 整卡预览

- `SettingsCard` 增加可选 `style`。
- `ThemeCard` 使用当前 draft 的 `backgroundColor` 与 `textColor` 渲染整卡。
- Reset 使用透明背景和跟随文字色的边框/文字，修改颜色与 Reset 均有组件测试覆盖。

## 自动验证

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`：3 个测试文件、39 项通过
- `pnpm build`
- `cargo fmt --all --manifest-path app/src-tauri/Cargo.toml -- --check`
- `cargo check --locked --all-targets --manifest-path app/src-tauri/Cargo.toml`
- `cargo test --all-targets --manifest-path app/src-tauri/Cargo.toml`：92 项通过
- `pnpm portable:build`

## 最终发布产物

| 产物 | 大小 | SHA256 |
| --- | ---: | --- |
| `app/src-tauri/target/release/breaktimer.exe` | 10,970,112 bytes | `F1BF9F969EF4E65E4750B4E9DD1C10E1B2A12862E61DC10E6CC1F34447C39D90` |
| `app/src-tauri/target/release/bundle/nsis/BreakTimer_0.1.0_x64-setup.exe` | 4,375,677 bytes | `B126B8419C69E8BEE48E6FC3F24E326B0D6AFB06163CC72D9852B6C276EAEF9D` |
| `app/src-tauri/target/release/bundle/portable/BreakTimer_0.1.0_x64-portable.zip` | 5,870,023 bytes | `716F56399423276E56851A858A8C8B702ACCBDA32555054A21888D2FEFE1112B` |

发布版可执行文件与便携 ZIP 为本轮最终人工验收对象；NSIS 随后从同一份已验收
发布版可执行文件重新生成。本轮不把“重新生成 NSIS”表述为重新完成一次安装/卸载验收，
但安装器打包路径与安装/卸载流程此前已通过人工验收。

## 人工验收

1. 便携版设置 `Breaks=5 minutes`、关闭闲置重置，第 5 分钟按时触发休息：通过。
2. 打开托盘菜单后跨过倒计时分钟变化，菜单保持打开；关闭后左上角无白点：通过。
3. Theme 卡片随背景色/文字色控件整卡实时变化，Reset 后恢复默认预览：通过。
4. 完整便携流程、同名目录标记、不可写目录失败、安装版互斥、便携自启动与 NSIS 隔离：通过。
5. 发布版 A12 非工作时段与 A13 闲置状态展示：通过。

人工验收通过后，SPEC-0002、SPEC-0005、SPEC-0006、SPEC-0010、SPEC-0012 均为 `done`，
PLAN-0002 阶段 5、PLAN-0002 与 roadmap M5 全部完成。
