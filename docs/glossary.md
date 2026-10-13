# 术语表

> 统一语言（ubiquitous language）。新增术语随时补充。

| 术语 | 英文 | 含义 |
| --- | --- | --- |
| 休息 | Break | 一次提醒或强制的休息 |
| 全屏遮挡层 | Backdrop | 休息时铺满每个显示器的覆盖层，挡住视线、限制分心；旧版为软遮挡 |
| 软遮挡 | Soft overlay | 置顶全屏但不抢焦点、不锁键盘鼠标、不阻止 Alt+Tab |
| 硬锁定 | Hard lock / kiosk | 独占输入、禁止切换任务；本期不做，见 ADR-0002 |
| 托盘 | Tray | 系统托盘常驻图标与菜单 |
| 自启动 | Auto-launch | 登录后自动运行应用 |
| 闲置重置 | Idle reset | 检测到用户离开后重置休息倒计时 |
| 命令/IPC | Command / IPC | 前端通过 Tauri `invoke` 调用 Rust 后端暴露的 command |
| 后端 | Backend | Tauri 的 Rust 进程，负责调度、窗口、托盘、持久化、系统集成 |
