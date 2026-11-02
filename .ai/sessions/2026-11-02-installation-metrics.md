# 2026-11-02 装机统计（SPEC-0018）

## 背景

用户想了解应用的实际使用规模，最初表述为「新增用户数 / 活跃用户数 / 总用户数」。
讨论后明确：桌面应用无账号体系，口径应为**装机数**，不是用户数。

## 确认的结论

- 口径：装机 = 一份独立运行数据目录 + 随机 `installId`；指标为累计装机、新增装机、
  活跃装机（DAU/WAU/MAU）、装机留存（D1/D7/D30、W1/W4）、版本分布、安装版/便携版占比。
- 事件：`install`（首次装机）+ `heartbeat`（每日最多一次）；时间粒度到日。
- 默认开启装机事件，设置页可关闭；首次启动做一次非阻塞告知。
- 字段按白名单最小化：`installId`、`day`、`firstLaunchDay`、`version`、`os`、`arch`、
  `locale`、`channel`、`event`、`schema`。
- 合规：不采集 IP、用户名、硬件指纹、路径、内容与精确时间；服务端不落 IP；
  明细 180 天后只保留聚合；不接第三方统计 SDK。
- 服务端在免费额度内自建，候选为 Cloudflare Worker + D1（推荐）或国内云函数。

## 已落盘

- 新增 `docs/specs/0018-installation-metrics.md`（`confirmed`）。
- 更新 `docs/specs/README.md` 索引、`docs/glossary.md`（装机 / 装机统计 / 分发量 /
  装机留存）、`docs/roadmap.md`。
- 修正 `docs/specs/0017-update-check.md` 的边界表述：更新检查本身不上报统计，装机统计
  另属 SPEC-0018，避免两处文档矛盾。

## 待办 / 未决

- 人工验收：Windows 上抓包确认请求体、断网补报、关闭开关、便携版与安装版各一次。

## 实现（同日）

- 用户确认服务端为 Cloudflare Worker + D1，新增 `docs/decisions/0019-installation-metrics-cloudflare.md`。
- 客户端 `app/src-tauri/src/telemetry/`：装机事件与每日心跳、白名单 Payload、
  90 秒延迟启动、30 分钟重试节流、5 秒超时、仅 HTTPS、不跟随重定向；开发构建跳过。
- 端点由 `option_env!("BREAKTIMER_METRICS_URL")` 注入，未设置时整体关闭。
- `StoreData` 新增 `installId`、`installFirstLaunchDay`、`telemetryLastPingDay`、
  `telemetryInstallReported`、`telemetryNoticeShown`；首次启动生成 UUIDv4。
- 设置新增 `analyticsEnabled`（默认 `true`）；设置页 `System` 页签新增
  `AnalyticsCard`；首次启动发一次系统通知告知。
- 服务端 `server/metrics/`：`wrangler.toml`、`schema.sql`、`queries.sql`（累计/新增/
  DAU/WAU/MAU/D1/D7/D30/W1/W4/版本/形态/语言）、`src/index.js`（严格校验、幂等写入、
  180 天清理）、`src/validate.js` 与 `node --test` 测试、部署 README。
- 发布流水线读取仓库变量 `vars.BREAKTIMER_METRICS_URL`；未配置时发布版统计关闭。

## 验证

- `pnpm format:check` / `lint` / `typecheck` / `test`（86）/ `build` 全部通过。
- `cargo fmt --all -- --check` / `check --locked --all-targets` /
  `test --locked --all-targets`（125）全部通过。
- `node --test server/metrics/test/validate.test.mjs`（10）通过。
- 未执行打包（铁律 7），人工验收待做。

## 文案调整

用户认为「匿名装机统计」的表述太硬，改为面向用户的友好说法：卡片标题
「帮助改进 BreakTimer-new」，开关「允许发送匿名使用信息」，说明中列出所传字段并强调
「无法识别你、不含休息内容或设置内容」；首次启动通知与 README 隐私段落同步改写。
机制、字段与合规约束不变。

## 后续调整

用户要求去掉首次启动的统计告知通知：删除 `show_notice_once`、`telemetryNoticeShown`
字段与 `telemetry.notice*` 文案；披露只保留设置页卡片与 README 隐私段落。
新增 `docs/decisions/0020-telemetry-without-startup-notice.md`（部分取代 ADR-0019 第 4 条）。
