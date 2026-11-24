# 关键技术决策与避坑记录

> 只保留当前仍有效的非显而易见取舍；被推翻的方案直接替换，不维护历史编号。

- **2026-11-24 文档体系**：采用 `AGENTS.md` + `architecture.md` + `log/` + `superpowers/{specs,plans,archive}`；不再维护 overview、roadmap、ADR 索引和计划索引，以减少跨会话读取成本。
- **桌面技术栈**：使用 Tauri v2 + Rust + 系统 WebView，前端保留 React + TypeScript；放弃 Electron，因为新方案体积更小且系统集成足够。
- **前后端边界**：调度、窗口、托盘、持久化和系统集成放在 Rust；React 只通过 Tauri command/event 访问后端。
- **休息调度**：保持纯状态机，平台空闲/锁屏通过 `SystemStateProvider` 注入；使用 `system-idle-time`，Windows 锁屏用 `OpenInputDesktop`。
- **休息覆盖层**：窗口铺满每个显示器 bounds，不使用原生全屏；提示条不可聚焦，激活 Popup 使用可聚焦输入阻断层。
- **关闭视觉遮罩**：`showBackdrop=false` 时覆盖窗仍铺满显示器并阻断输入，只隐藏视觉遮罩，不缩成小窗。
- **声音播放**：放在 Rust `sounds` 模块，用 `rodio` 播放内置 WAV；前端不负责休息声音生命周期。
- **托盘刷新**：根菜单只绑定一次，文本原地更新、动态项原地增删；放弃每秒重建根菜单。
- **设置保存**：先持久化再计算副作用；只有自启动、启用状态和休息频率变化才重启相关链路，其他字段保留当前倒计时。
- **应用身份**：产品名为 `BreakTimer-new`，可执行文件为 `breaktimer-new`，标识为 `com.githunhunhub.breaktimernew`；不继承旧版数据。
- **便携模式**：程序目录存在 `portable.flag` 时把设置、日志和 WebView2 数据写入 `data\`；目录不可写时退出，不回退 AppData。
- **多语言**：`app/locales/<locale>.json` 同时供 React 与 Rust 使用；`en-US` 为回退语言，只支持轻量占位符和 `one/other` 复数。
- **更新检查**：只检查 GitHub 最新稳定版并打开网盘下载页，不引入 updater、不自动下载安装；便携版由用户手动覆盖并保留 `data\`。
- **版本控制**：GitHub 是唯一远程；`develop` 日常开发，`master` 只用发版，Tag 必须从 `master` 创建且已推送不可移动。
- **发布流水线**：推送 `vX.Y.Z` Tag 触发 GitHub Actions；从同一 release executable 生成便携 ZIP 与 NSIS，并上传哈希文件。
- **PowerShell 编码**：含中文的脚本必须保存为 UTF-8 with BOM；Windows PowerShell 5.1 会按 ANSI 解码无 BOM 文件。
- **客户端统计存储**：使用 EdgeOne KV + HLL 固定 16 分片，不用 D1、Cloudflare 或逐客户端事实表；key 数不随客户端数增长。
- **客户端统计口径**：只保留日活跃、版本/渠道/OS、日新增与新增渠道；不做精确用户数、留存、卸载回传或累计指标。
- **统计写入**：安装写 3 个 key，心跳写 2 个 key，串行 `get → merge → put`；KV 无 CAS，接受并发低估并披露约 1～3% HLL 误差。
- **统计端点**：必须使用稳定自定义 HTTPS 域名和构建期 `BREAKTIMER_METRICS_URL`；默认项目域名的短时预览链接不适合生产。
- **统计隐私**：只接收白名单字段，不读取 IP/GEO，不记录请求体、令牌或明文 `installId`；只保存 HLL 聚合。
- **公开统计接口**：`/api/public-report` 同源、无令牌，只允许 7/30/90 天日粒度；私有 `/api/report` 继续令牌鉴权并支持 JSON/CSV。
- **公开报表读取**：先用 `h_act_` 探测空 namespace，再按实际前缀列举并读取；并发上限 8，Cache API 仅缓存成功 200 响应 60 秒。
- **统计性能现状**：停止按理论分片盲读，但线上 90 天首次请求仍可能约 15 秒；重复缓存命中和长范围延迟继续作为活跃需求。
- **统计 V2 兼容**：只读取 `h_act_`、`h_ver_`、`h_newch_`；旧 key 保留但不迁移、不删除、不参与报表，历史渠道/OS 无法重建。
- **公开看板**：放在统计服务 `/dashboard/`，与 API 同源，不用 CORS，不把维护令牌放进前端；与 `site/` 宣传页隔离。
- **宣传页**：`site/` 为无构建器的静态中英双语站点，资源本地化，GitHub Pages 基址固定在 `/breaktimer-new/`。
- **下载入口**：用户从项目主页进入百度/夸克网盘；GitHub Release 正文只保留变更日志和隐藏下载元数据。
- **品牌图标**：`app/assets/logo.svg` 是唯一源，派生 favicon、PNG、ICO 与 ICNS；不直接改旧源码中的图标。
- **许可证**：整个仓库采用 GPL-3.0-or-later，复用上游资产需保留署名、修改说明与同许可证义务。
- **已否决方案**：Tauri v1、Electron、原生全屏软遮挡、Gitee 镜像、应用内自动更新、完整 ICU、远程 CDN 和逐客户端精确统计均不采用。
