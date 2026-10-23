# 术语表

> 统一语言（ubiquitous language）。新增术语随时补充。

| 术语           | 英文                   | 含义                                                                                          |
| -------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| 产品名         | Product name           | 用户可见的 `BreakTimer-new`；技术包名和可执行文件使用小写 `breaktimer-new`                    |
| 应用标识       | Application identifier | Tauri/Windows 身份 `com.githunhunhub.breaktimernew`，决定独立的数据、单实例、自启动与卸载身份 |
| 休息           | Break                  | 一次提醒或强制的休息                                                                          |
| 全屏遮挡层     | Backdrop               | 休息时铺满每个显示器的覆盖层；可显示半透明视觉遮罩，也可只显示居中休息卡                      |
| 输入阻断覆盖层 | Input-blocking overlay | 覆盖完整显示器 bounds、置顶且可聚焦的应用窗口，使底层应用、任务栏和托盘不能接收鼠标输入       |
| 视觉遮罩       | Visual backdrop        | 由 `showBackdrop` 和 `backdropOpacity` 控制的半透明视觉层，不影响覆盖窗几何与输入阻断         |
| 旧版软遮挡     | Legacy soft overlay    | 置顶全屏但不抢焦点、不锁输入；保留为历史实现词汇，不再是 Popup 激活休息的新语义               |
| 硬锁定         | Hard lock / kiosk      | 独占输入、禁止切换任务；本期不做，见 ADR-0002                                                 |
| 托盘           | Tray                   | 系统托盘常驻图标与菜单                                                                        |
| 自启动         | Auto-launch            | 登录后自动运行应用                                                                            |
| 闲置重置       | Idle reset             | 检测到用户离开后重置休息倒计时                                                                |
| 命令/IPC       | Command / IPC          | 前端通过 Tauri `invoke` 调用 Rust 后端暴露的 command                                          |
| 后端           | Backend                | Tauri 的 Rust 进程，负责调度、窗口、托盘、持久化、系统集成                                    |
| 语言标识       | Locale                 | 使用 BCP 47 形式表示的语言与地区，例如 `en-US`、`zh-CN`；也是翻译资源的规范标识               |
| 翻译资源       | Locale resource        | `app/locales/<locale>.json` 中自描述 locale、原生名称、别名和消息的唯一翻译源                 |
| 有效语言       | Effective locale       | 应用最终实际使用的 locale；由手动偏好或启动时系统语言解析，无法支持时回退 `en-US`             |
| 回退语言       | Fallback locale        | 缺失 key 或语言不受支持时使用的基准语言；本项目固定为 `en-US`                                 |
