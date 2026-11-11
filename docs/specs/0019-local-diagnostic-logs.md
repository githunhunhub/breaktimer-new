# SPEC-0019：本地诊断日志

- 状态：done
- 日期：2026-11-03
- 关联：SPEC-0012 · SPEC-0018 · 代码 `app/src-tauri/src/diagnostics.rs`

## 背景 / 问题

当前应用只有 Rust `eprintln!` 输出。发布版是 Windows GUI 程序，没有持久终端；
Rust panic、WebView 未捕获异常和后台操作失败通常无法在事后定位。现有装机统计明确禁止
上报崩溃内容和日志，因此诊断能力应只保存在本机。

## 需求（做什么）

1. 应用维护本地诊断日志，不发送网络请求，不接入装机统计或更新检查。
2. 安装版日志写入
   `%LOCALAPPDATA%\com.githunhunhub.breaktimernew\logs\breaktimer-new.log`；
   便携版写入 `<程序目录>\data\logs\breaktimer-new.log`。
3. 当前日志达到 2 MiB 时轮转为 `breaktimer-new.1.log`；只保留一个备份。
4. 每条日志包含本地时间（含时区）、级别和消息。启动时记录应用版本、安装形态、操作系统
   和架构。
5. 后端现有的非致命错误输出写入诊断日志，同时继续输出到开发终端。
6. Rust panic 记录 panic 内容、位置和 backtrace，再调用默认 panic hook。
7. WebView 的未捕获 `error` 和 `unhandledrejection` 交给后端写入同一日志；日志失败不得
   影响界面或产生新的未处理异常。
8. 日志初始化或写入失败不得阻止应用启动。
9. 日志不得记录设置全文、休息标题/正文、`installId`、用户名、主机名或硬件信息。
10. README 提供安装版、便携版日志位置和基本排查入口。

## 验收标准（可测）

- [x] **D1** 应用启动后创建日志，首条记录包含版本、安装形态、系统和架构。
- [x] **D2** 现有后端错误路径通过统一诊断接口写入文件，并在开发终端可见。
- [x] **D3** 当前日志超过 2 MiB 后轮转，备份文件保留一个，后续记录写入新文件。
- [x] **D4** 触发 Rust panic 时日志包含 panic 消息和位置。
- [x] **D5** 前端未捕获异常与 Promise rejection 通过 Tauri command 写入日志；桥接失败保持静默。
- [x] **D6** 日志目录不可创建或不可写时应用仍可启动，错误只回退到 stderr。
- [x] **D7** 便携版日志位于 `data\logs\`，安装版日志位于应用本地数据目录 `logs\`。
- [x] **D8** `diagnostics` 模块没有网络依赖或遥测调用。
- [x] **D9** 自动化测试覆盖写入、轮转、前端异常转换；项目验证门禁全部通过。

## 人工验收步骤

### 准备

1. 关闭现有开发实例，确认没有其他 `cargo` 或 `pnpm tauri:dev` 正在使用同一构建目录。
2. 在 `<repo-root>/app` 执行 `pnpm tauri:dev`。

### 安装版启动日志

1. 打开
   `%LOCALAPPDATA%\com.githunhunhub.breaktimernew\logs\breaktimer-new.log`。
2. 确认新增一行 `[INFO] started version=... channel=installer os=windows arch=x86_64`。

### 前端未捕获异常

1. 在开发窗口按 `Ctrl+Shift+I` 打开 WebView2 DevTools。
2. 在 Console 执行 `Promise.reject(new Error("diagnostic acceptance"))`。
3. 确认日志出现 `[ERROR] uncaught frontend error: diagnostic acceptance`，且界面不受影响。

### 其余边界

1. 将日志目录设为不可写，确认应用仍可启动且错误只回退到 stderr。
2. 以便携模式启动，确认日志写入 `<程序目录>\data\logs\`。
3. 触发一次测试 panic，确认日志包含 panic 消息与位置。

## 验收记录

- **Windows 人工验收（2026-11-11）**：用户在 Windows 真机按上方步骤执行并通过：
  安装版启动日志记录版本、安装形态、系统与架构；前端未捕获异常写入 `[ERROR]` 且界面正常；
  日志目录不可写时应用仍可启动；便携模式写入 `<程序目录>\data\logs\`；panic 记录消息与位置
  （对应 D4、D6）。

## 非目标 / 边界

- 不提供日志上传、崩溃报告服务器、远程诊断或用户账号关联。
- 不记录每个调度 tick、窗口事件或用户操作，避免日志膨胀和隐私风险。
- 不生成 Windows minidump，不替代 Windows 事件查看器与 WER。
- 不调整 `panic = "abort"`；先使用 panic hook 记录后再终止进程。

## 设计要点

- 新增 Rust `diagnostics` 模块，使用已有 `log` 宏接口和自定义本地轮转 writer。
- `AppPaths` 增加 `logs_dir`，安装版基于应用本地数据目录，便携版基于 `data\`。
- 日志 writer 用进程内互斥保证多线程安全；初始化失败退化为 stderr。
- 前端只在全局异常边界转发文本，不增加逐调用日志。

## 实现计划

- [x] 新增本地轮转 writer、全局 logger 与 panic hook，并接入启动流程。
- [x] 将后端 `eprintln!` 错误路径改为统一日志接口。
- [x] 增加前端全局异常捕获与 `log_frontend_error` command。
- [x] 更新 README、架构、路线图和 spec 索引。
- [x] 执行 Windows 人工验收。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-03 | 创建并确认本地诊断日志需求 |
| 2026-11-03 | 将 Windows 人工验收步骤归档到本 spec，移除对 `.ai/sessions/` 的依赖（ADR-0021） |
| 2026-11-11 | Windows 人工验收通过（D4、D6 确认），实现计划完成，状态改为 done |
