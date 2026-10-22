# ADR-0009：Windows 同时提供 NSIS 安装包与便携 ZIP

- 状态：已接受
- 日期：2026-10-21
- 决策者：项目作者
- 取代范围：仅取代 ADR-0008 中「暂不提供便携版」的边界

## 背景

NSIS 安装包适合常规安装与登录自启动，但用户还需要一种不写注册表安装目录、
解压即可运行的 Windows 交付方式。便携版必须把配置和 WebView2 运行数据放在
程序所在目录，才能随目录整体移动，并在卸载或删除目录后不残留应用数据。

Tauri 在 Windows 上默认把 WebView2 数据写入 `app_local_data_dir()`。仅修改
`settings.json` 路径不足以实现真正的便携数据布局，因此所有 WebView 窗口都必须
显式指定数据目录。

## 决策

Windows 发布同时提供 NSIS 安装包和便携 ZIP。

- NSIS 安装包继续遵循 ADR-0008，安装版数据路径保持不变。
- 便携 ZIP 顶层包含 `BreakTimer\breaktimer.exe`、`portable.flag` 和 `README.txt`。
- 只有可执行文件同目录存在普通文件 `portable.flag` 时才启用便携模式。
- 便携模式的设置写入 `<程序目录>\data\settings.json`，WebView2 数据写入
  `<程序目录>\data\webview2\`。
- 便携目录不可写时显示明确错误并退出，不静默回退到 AppData。
- 安装版与便携版共用同一个应用标识和单实例身份，不能同时运行。
- `Launch at login` 在便携模式下注册当前可执行文件；移动目录后需要重新开启。
- 便携 ZIP 不预置 `data\`，由首次成功启动创建。
- 便携 ZIP 继续依赖系统中可用的 Microsoft Edge WebView2 Runtime，不内置固定版本运行时。

## 理由

- 满足免安装运行和同目录数据留存的核心需求；
- 显式 `data` 布局便于用户备份、迁移和删除；
- 不改变安装版路径与单实例语义，减少两个发行方式的长期差异；
- 不内置 WebView2 Runtime 可以避免发布包增加数百 MB，并继续使用系统安全更新。

## 影响

- 便携版必须放在用户可写目录，例如桌面或自定义工具目录，不能放在
  `Program Files` 等普通用户不可写位置。
- 移动便携目录后，已有数据会随 `data\` 一起移动，但 Windows 登录自启动仍指向旧路径，
  需要在新位置重新开关一次 `Launch at login`。
- 没有 WebView2 Runtime 的 Windows 环境需要先安装 Microsoft Edge WebView2 Runtime。
- 不改变 ADR-0008 中关于未签名、MSI、自动更新和安装模式的其他决策。
