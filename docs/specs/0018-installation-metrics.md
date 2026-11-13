# SPEC-0018：装机统计（Installation Metrics）

- 状态：in-progress
- 日期：2026-11-02
- 关联：ADR-0019 · ADR-0020 · ADR-0023 · SPEC-0010 · SPEC-0012 · SPEC-0014 · SPEC-0017

## 背景 / 问题

仓库目前只能看到 GitHub Release 资产的 `download_count` 和网盘后台的下载量。下载量不等于
装机量：重复下载、镜像分发、CI 与自动化会放大数字，而且无法回答「有多少份装机」「今天还有
多少在运行」「各版本采用情况如何」。

应用没有账号体系，能稳定统计的最小单位是**一次独立装机**（一份独立数据目录 +
一个随机 `installId`）。本轮只做装机口径的最小匿名上报，供维护者个人查看；不接入第三方
统计 SDK，不上报任何可识别自然人的信息。

Cloudflare Worker + D1 路线部署不通后，服务端改为 EdgeOne Pages / Makers Edge Functions + KV
（ADR-0023）。项目作者明确本轮**不需要精确统计、不关心逐装机明细**；服务端使用 HyperLogLog
（HLL）近似草图，只输出下列八项统计值。

## 范围：八项统计指标

| ID | 指标 | 口径 |
| --- | --- | --- |
| M1 | 日活跃量 | 客户端本地自然日内，收到 `install` 或 `heartbeat` 的去重装机估计；首装当天算活跃 |
| M2 | 月活跃量 | 自然月内每日活跃 HLL 合并后的去重装机估计；**不是每日 M1 相加** |
| M3 | 每日各版本活跃量 | 按事件 `version` 分组的日去重装机估计 |
| M4 | 每月各版本活跃量 | 自然月内每日同版本 HLL 合并后的去重装机估计 |
| M5 | 日新增装机量 | `install` 事件按客户端 `firstLaunchDay` 归日的去重装机估计；离线补报回填原日期 |
| M6 | 月新增装机量 | 自然月内 M5 日 HLL 合并后的去重装机估计，按 `firstLaunchDay` 归月 |
| M7 | 总装机数 | 历史 `install` 事件 HLL 合并后的去重装机估计；只增不减，卸载不回传 |
| M8 | 各版本装机数 | 按首次收到的 `install` 事件版本分组的历史去重装机估计 |

所有报表输出都必须带 `approximate=true`、`method=hll`、
`consistency=eventual_60s`；统计单位是「装机」，不是自然人。M3/M4 是版本活跃量，不是互斥
占比：同一装机若月中升级，可能同时出现在 `0.1.1` 与 `0.1.2` 的月活跃估计中。M8 是
「首次上报版本」近似值：升级后重放的 `install` 事件可能带新版本，HLL 无法证明严格首装版本，
也不能阻止同一 ID 进入多个版本草图；`ΣM8 ≈ M7`，不承诺相等。

### 本轮不输出

安装版/便携版占比、装机留存（D1/D7/D30、W1/W4）、滚动 WAU/MAU、语言/OS 分布、下载量入库、
请求次数看板、逐装机明细与可反查 `installId` 的记录。需要这些指标时另立 spec。

## 口径（术语）

| 名词 | 定义 |
| --- | --- |
| 装机 | 一份独立的运行数据目录（安装版 `%APPDATA%\com.githunhunhub.breaktimernew`，便携版 `data\`）及其随机 `installId` |
| 活跃装机 | 指定自然日/自然月有 `install` 或 `heartbeat` 的去重装机估计 |
| 新增装机 | 首次上报的 `install` 按 `firstLaunchDay` 归日的去重装机估计 |
| 累计装机 | 历史 `install` 的去重装机估计；只增不减，卸载不可回传 |
| HLL 草图 | 由 `installId` 哈希派生的寄存器数组，可估计基数、可合并，但不能还原明细 |
| 分发量 | 下载次数（GitHub `download_count` + 网盘后台），与装机量是两个不同的数 |

口径边界（必须在报表与文案中遵守）：

- 「装机」不是「人」：一人多机计多次装机；便携版整目录复制到另一台机器会共用同一个
  `installId`，属于已知低估。
- 安装版覆盖升级、卸载后重装（AppData 未清理）都不新增装机；手动清理数据目录后重装算新装机。
- HLL 约有 1～3% 相对误差；KV 60 秒最终一致、并发读-改-写可能丢失一次更新并低估；当前日
  是进行中快照，历史日是稳定快照。
- 无法统计卸载，因此只给「累计新增装机的趋势」和「活跃装机趋势」，不提供「现存用户数」。

## 需求（做什么）

1. 客户端在首次启动时生成随机 `installId`（UUIDv4，本地生成，与硬件、账号、路径无关），
   持久化在现有 `settings.json` 的 StoreData 中，不新增文件。
2. 上报两类事件：
   - `install`：每个 `installId` 在成功上报前每次启动都可重试，服务端以 HLL 合并去重；
   - `heartbeat`：运行中每个自然日最多一次，用于活跃估计。
3. 统计默认开启；设置页在「帮助改进 BreakTimer-new」卡片中提供「允许发送匿名使用信息」
   开关（默认开）。关闭后立即停止上报，并丢弃尚未发送的待发事件。
4. 不发送任何统计相关的启动通知或弹窗；披露放在设置页「帮助改进 BreakTimer-new」
   卡片与 README 隐私段落中，文案中英文齐全。
5. 只允许上报「上报字段白名单」中的字段；任何新增字段都必须先改本 spec 并评估合规性。
6. 时间精确到**日**：不使用精确时间戳，`day` 与 `firstLaunchDay` 使用客户端本地日期
   （`YYYY-MM-DD`）。
7. 请求失败必须静默：单次重试、5 秒超时、不阻塞启动；离线时最多保留一条待发事件，
   下次启动或下一个心跳周期补报，且 `install` 事件的新增归日仍以 `firstLaunchDay` 为准。
8. 同一天重复上报不得使 HLL 估计重复增长；服务端只按稳定哈希更新固定分片草图，
   不保存 `(installId, day)` 事实 key。
9. 开发构建、测试与 CI 不上报（与更新检查的开发构建跳过策略一致）。
10. 服务端在免费额度内运行，只提供维护者可读的匿名聚合报表；不放广告、不做用户画像、
    不与第三方共享数据。
11. 报表可输出 M1～M8，按 `from`、`to`、`granularity=day|month` 查询，支持 JSON 与 CSV；
    所有数值为近似估计，且不得输出逐装机列表。
12. 下载量（分发量）作为对照指标：手工读取 GitHub Release 资产 `download_count` 与网盘
    后台数据，不写入 KV。
13. 客户端上报另受一个构建期总开关控制。服务端端点部署完成前，开关保持关闭：应用不发出
    任何统计请求，设置页不显示「帮助改进 BreakTimer-new」卡片；端点部署并核验完成后把
    开关打开，恢复需求 3 的默认开启与卡片行为。开关不影响本地 `installId` 的生成。

## 上报字段白名单

| 字段 | 类型 | 示例 | 说明 |
| --- | --- | --- | --- |
| `schema` | int | `1` | 上报协议版本 |
| `event` | enum | `install` | `install` / `heartbeat` |
| `installId` | uuid string | `3f2a…` | 本地生成的随机 UUIDv4，不可反推设备 |
| `day` | `YYYY-MM-DD` | `2026-11-02` | 事件发生的本地日期（不含时分秒） |
| `firstLaunchDay` | `YYYY-MM-DD` | `2026-10-30` | 仅 `install` 事件；首次生成 ID 的日期 |
| `version` | string | `0.1.2` | 应用版本 |
| `os` | enum | `windows-11` | 仅 `windows-10` / `windows-11` 等粗分类，不含 build |
| `arch` | enum | `x64` | 架构 |
| `locale` | string | `zh-CN` | 有效语言标签，不含时区 |
| `channel` | enum | `portable` | `installer` / `portable` |

`channel`、`os`、`arch`、`locale` 保留在白名单中用于协议兼容性，但本轮 M1～M8 不使用这些
字段分组，服务端不将其写入草图。

禁止上报（代码评审与测试都必须拒绝）：

- 原始 IP、地理位置、时区、精确时间戳；
- Windows 用户名、主机名、SID、注册表用户信息；
- 硬件指纹（MAC、磁盘序列号、主板/CPU 信息）、设备 ID、广告 ID；
- 安装路径、可执行文件路径、进程列表、窗口标题；
- 休息标题/正文、设置全文、使用明细、崩溃内容、日志；
- Cookie、账号信息、任何可与其他系统关联的标识。

## 合规要求

1. **数据最小化**：只上报白名单字段，全部为装机级、匿名、日粒度数据，不与任何自然人标识
   关联；`installId` 不得由硬件信息派生，也不得与账号绑定。KV 只保存哈希寄存器草图，
   不保存明文 `installId` 或逐装机事件。
2. **服务端不落 IP**：业务代码不读取、不记录、不持久化客户端 IP 与请求体；不开启
   会保留请求体的自定义日志。平台可能自动收集的请求/访问日志字段与保留期必须在部署前
   于控制台核验，并在隐私说明中如实披露。
3. **告知与选择**：默认开启的前提下，设置页卡片必须说明「上报什么、为什么、如何关闭」，
   README 隐私段落保持同一口径；不额外弹出或推送告知；开关可随时关闭，关闭后不再有
   任何统计请求。
4. **目的限定**：数据仅用于 M1～M8 汇总趋势，不用于广告、画像、风控、个性化推荐，
   不向第三方出售或共享。
5. **保留期限**：历史草图长期保留以维持 M7/M8 只增不减；当前不设清理任务。KV 容量达到
   免费额度的 80% 时另立需求评估归档。明细不入 Git、不导出逐装机清单。
6. **存储位置**：EdgeOne KV 的中心存储区域如可指定，优先选择亚太区域；如实际区域
   不可指定或在中国境外，需在 README 隐私段落如实说明。去标识化的装机估计不包含
   个人信息，但仍按此标准处理。
7. **不跨境传输个人信息**：由于不采集个人信息，本需求不涉及个人信息出境；一旦未来需要
   采集任何可识别信息，必须另立 spec 并做合规评估。
8. **公开说明**：`README.md` 增加隐私段落；设置页文案与 README 必须一致，不得出现
   「用户数」「无任何统计」等与实际不符的表述。
9. **第三方限制**：不引入第三方统计 SDK、Web 统计脚本或 Cookie；客户端只直接请求自建
   HTTPS Edge Function 端点，不跟随重定向、不带 Cookie，不能直接访问 KV。

## 验收标准（可测）

- [ ] **I1** 首次启动生成并持久化 `installId`；重启、覆盖升级后保持不变。
- [ ] **I2** 安装版覆盖安装、卸载后保留 AppData 重装，均不新增装机。
- [ ] **I3** 便携版整目录移动到其他路径仍是同一装机；重新解压一份新的 `data\` 计为新增装机。
- [ ] **I4** 首次运行发出 `install` 事件，请求体字段与白名单完全一致，无多余字段。
- [ ] **I5** 同一天多次启动只产生一次 `heartbeat`；跨日运行会补一次。
- [ ] **I6** 断网首次启动不阻塞 UI；联网后补报，且新增装机归到 `firstLaunchDay` 当天。
- [ ] **I7** 关闭开关后不再发出任何统计请求，已排队事件被丢弃；重新开启后恢复。
- [ ] **I8** 开发构建、测试与 CI 不发出统计请求。
- [ ] **I9** 请求体与业务日志中不存在禁止字段（IP、用户名、路径、内容等），有自动化断言。
- [ ] **I10** 同一 `installId` 的重复 `install` 与同一天的重复 `heartbeat` 不增加 HLL
      估计；并发写入允许低估，但报表必须标注近似与最终一致。
- [ ] **I11** `GET /api/report` 经维护令牌鉴权后，可按日/月输出 M1～M8 的 JSON/CSV，
      包含 `approximate=true`、`method=hll`、`consistency=eventual_60s`，
      且不含逐装机清单或明文 `installId`。
- [ ] **I12** 设置页卡片说明与开关齐备、中英文完整，README 隐私段落与其一致；
      启动时不发送统计相关的系统通知或弹窗。
- [ ] **I13** `README.md` 隐私段落与实现一致，文案中不出现「用户数」等不准确表述。
- [ ] **I14** 统计请求只走 HTTPS，不跟随重定向，无 Cookie。
- [ ] **I15** 关闭统计后，应用行为、休息调度、更新检查均不受影响。
- [ ] **I16** 上报总开关关闭时不发出任何统计请求，设置页不显示「帮助改进 BreakTimer-new」
      卡片；开关打开且配置了端点后恢复 I12 的行为。

## 人工验收步骤

1. 按 `server/metrics/README.md` 部署 EdgeOne Pages / Makers Edge Functions + KV，绑定
   稳定的自定义 HTTPS 域名与变量名 `METRICS_KV`，在构建环境中设置
   `BREAKTIMER_METRICS_URL=https://<metrics-domain>/v1/collect`，并把客户端上报总开关
   `REPORTING_SWITCH` 打开后重新构建；记录控制台访问日志字段、保留期与 KV 区域。
2. 分别使用 NSIS 安装版与便携 ZIP 启动，抓包确认只发送白名单字段，且没有 IP、
   用户名、路径或内容字段。
3. 首次启动断网，确认 UI 不阻塞；恢复网络后确认 `install` 补报且归日为
   `firstLaunchDay`。
4. 关闭统计开关，确认不再发出请求；重新开启后确认恢复上报。
5. 覆盖安装、便携目录移动与复制一份新的 `data\`，分别核对估计值符合本 spec 的口径；
   重放相同请求确认估计不重复增长。
6. 导出一次日/月 JSON 与 CSV，逐项核对 M1～M8 及近似元数据；确认报表无逐装机清单。
7. 在 EdgeOne 控制台核验平台自动访问日志、WAF 配置、域名备案/加速区域、KV 实际绑定
   变量与区域；确认 `_lib/` 共享模块未暴露为可访问的公共路由，记录结论后方可完成人工验收。

### 部署核验记录（2026-11-13）

端点已部署到 EdgeOne Makers（项目 `breaktimer-new-metrics`，根目录 `server/metrics`，
生产分支 `develop`，输出目录 `public`，加速区域不含中国大陆），自定义域名
`https://metrics.hunhun.qd.je`。已验证：

| 项 | 结论 |
| --- | --- |
| `GET /robots.txt` | `200`，静态输出目录 `public` 生效 |
| `GET /v1/collect` | `405`，路由挂在域名根层而非 `server/metrics/...` |
| `GET /api/report`（无令牌） | `401`，说明 `MAINTENANCE_TOKEN` 已通过 `context.env` 注入 |
| `GET /_lib/collect.js`、`GET /edge-functions/_lib/hll.js` | `404`，共享模块未暴露（Q7 关闭） |
| `POST /v1/collect`（白名单心跳） | `204`，KV `get`/`put` 全部成功，说明 `METRICS_KV` 绑定可用；`context.env` 的键里没有 `METRICS_KV`，绑定为全局变量形式（Q5 关闭） |
| `GET /api/report`（带维护令牌，当日 `day` 报表） | `200`，`approximate` / `method=hll` / `consistency=eventual_60s` 元数据齐全；`active=1`、`versionsActive={"0.0.0":1}`（M1、M3），`newInstalls=0`、`totalInstalls=0`、`installsByVersion={}`，与只发过心跳的测试一致 |
| 同一报表在写入后立即读取 | `versionsActive` 一度为空，约 60 秒后复测恢复正常，印证 KV 最终一致（ADR-0023）：核对报表前需留出同步窗口，读不到不等于写入失败 |
| `POST /v1/collect`（白名单 `install`）后复测同日报表 | `totalInstalls=1`、`installsByVersion={"0.0.0":1}`、`newInstalls=1`、`active=2`、`versionsActive={"0.0.0":2}`：M5、M7、M8 打通，且两份装机的 HLL 去重与版本分组正确 |
| KV 控制台 key 形态 | 测试心跳后出现 `h_act_20261113_04` 与 `h_ver_20261113_04` 两个 key，分片号由 `installId` 哈希决定、每日每维度只写中被命中的那一个分片，与固定 16 分片设计一致 |

部署期发现并修复一个平台差异：EdgeOne 的 `context.request.body` 虽为 `ReadableStream`
却恒为空，请求体只经 `request.text()` 暴露；按流读取会让所有合法上报返回
`400 invalid JSON`。`_lib/collect.js` 已改为优先 `text()`，其余形态保留为回退，
并在 `server/metrics/test/collect.test.mjs` 与 `server/metrics/README.md`
「平台差异」一节留下记录（提交 `5845d8c`）。

同日按官方技能包 `edgeone-makers-tools`（Edge Functions / KV / frameworks / deploy）
复核：KV 全局绑定、`_` 前缀内部模块不参与路由、V8 运行时限制、KV key 字符集与容量
均与实现一致；两处表述偏差（「兼容 `context.env`」「`edgeone.json` 仅支持 headers」）
已更正，并给 `/api/report` 的 KV 读取加上分批并发。对照表见 `server/metrics/README.md`
「与官方 Makers 技能包的对照」。

HLL 草图无法删除单个元素，测试心跳会永久留在当日草图里。两次合成测试（心跳与
`install`）各写一个分片：心跳写 `h_act_20261113_04`、`h_ver_20261113_04`；`install`
写 `h_act_20261113_14`、`h_ver_20261113_14`、`h_new_20261113_14`、`h_total_14`、
`h_install_ver_14`（两个测试 `installId` 的哈希分片分别为 04 与 14）。正式启用客户端
上报前，在 KV 控制台删除这些测试 key 即可把统计归零。

仍待人工核验：平台自动访问日志字段与保留期、KV 中心存储区域、WAF 配置（Q4）；
自定义域名的备案与加速区域（Q3）；`/api/report` 的月粒度（M2/M4/M6，线上尚未调用，
目前仅由单元测试覆盖）；客户端侧验收（抓包、断网补报、开关、便携/安装版）。

## 非目标 / 边界

- 不做账号、登录、跨设备身份合并或设备指纹。
- 不做功能级埋点（休息完成率、跳过/推迟次数）、崩溃上报与性能监控；如需要另立 spec。
- 不做实时看板、公开数据页或徽章；报表只供维护者本地查看。
- 不做精确去重、装机留存、滚动 WAU / MAU 与逐装机明细；不输出 `upper_bound=true`。
- 不统计卸载，不承诺「现存活用户数」。
- 不改更新检查流程；更新检查本身仍不携带任何标识（SPEC-0017）。
- 不引入第三方统计 SDK，不上报任何用户内容。
- macOS / Linux 不在本轮验收范围（仅保留代码兼容）。

## 设计要点

- 客户端 `app/src-tauri/src/telemetry/`：纯函数负责事件构造与日期计算，HTTP 与调度隔离，
  测试不访问网络；端点 `POST /v1/collect`、字段白名单与 `410` 停用语义保持不变。
- StoreData 新增：`installId`、`installFirstLaunchDay`、`telemetryLastPingDay`、
  `telemetryPendingInstall`；设置新增 `analyticsEnabled`（默认 `true`），旧设置缺字段时
  按默认值加载。
- 上报时机：启动后延迟 60～120 秒（与更新检查的 30 秒错开）；之后每跨一个本地自然日
  补一次心跳；UI 不等待结果。
- 端点由构建期环境变量 `BREAKTIMER_METRICS_URL` 注入；未设置时统计能力整体关闭，
  保证 fork 与本地构建不会把数据发到维护者端点。
- 客户端上报总开关 `REPORTING_SWITCH`（`app/src-tauri/src/telemetry/mod.rs`）当前为
  `false`：服务端部署完成前彻底屏蔽上报，并通过 `get_app_info` 的
  `analyticsReportingEnabled` 隐藏设置页统计卡片。只有开关打开且端点可用时才会上报。
- 客户端边界：`Tauri Rust reqwest → 自定义 HTTPS 域名 → Edge Function → METRICS_KV`。
  EdgeOne KV 仅由 Edge Functions 访问，客户端不能直连；平台默认项目域名在中国大陆需要
  3 小时预览链接，不能作为稳定端点。
- 服务端（ADR-0023）：`server/metrics/` 的 Edge Functions、HLL 与报表代码；无旧 Worker 代码、
  D1 schema、SQL 报表、`wrangler.toml` 或每日清理 Cron。共享模块不导出 handler，路由使用
  通用 `onRequest` 并在代码中限制 POST/GET；`edgeone.json` 当前只声明 `headers`，构建与
  输出目录写在控制台（Git 推送构建）。文件本身还支持 `buildCommand` / `outputDirectory`，
  但两者优先级未核验，暂不重复声明。

### KV 存储结构（ADR-0023）

KV key 只允许数字、字母与下划线；日期写成 `YYYYMMDD`，`shard` 为 `00`～`15` 的两位十进制。
`installId` 经 SHA-256 得到 64 位哈希：低位决定 16 个固定分片，随后取 32 位作为 HLL
输入，低 14 位决定寄存器索引、其余 18 位决定前导零计数。HLL 精度 `p=14`
（`m=16384`），5 bit 寄存器按 8 个一组打包为 5 字节，再编码为十六进制字符串；
服务端不保存明文 `installId`。

| 类别 | Key 格式 | Value | 写入规则 |
| --- | --- | --- | --- |
| 日活跃 HLL | `h_act_<YYYYMMDD>_<shard>` | HLL 草图 JSON | `install` 与 `heartbeat` 都合并 |
| 日新增 HLL | `h_new_<YYYYMMDD>_<shard>` | HLL 草图 JSON | 仅 `install`，日期为 `firstLaunchDay` |
| 日版本活跃 HLL | `h_ver_<YYYYMMDD>_<shard>` | `{ "<version>": HLL 草图 }` | 两类事件按事件 `version` 合并；版本字符串在 value 中 |
| 历史总装机 HLL | `h_total_<shard>` | HLL 草图 JSON | 仅 `install` |
| 各版本装机 HLL | `h_install_ver_<shard>` | `{ "<version>": HLL 草图 }` | 仅 `install`，按首次上报版本估计 |

每个有事件的自然日最多 48 个 key，历史全局 32 个 key；一年约 1.8 万个 key，与 1000 或
10000 份装机无关。写入时逐 key `get` → 合并 → `await put`，返回 `204` 前必须全部完成；
KV 失败返回 `5xx` 让客户端重试。不使用随机分片、事实键、`SHARD_LIMIT`、
`s_retention_*` 或清理状态键。

### 报表接口

```text
GET /api/report?from=YYYY-MM-DD&to=YYYY-MM-DD&granularity=day|month&format=json|csv
Authorization: Bearer <MAINTENANCE_TOKEN>
```

`day` 粒度输出每个日期的 M1、M3、M5；`month` 粒度按自然月合并日 HLL 输出 M2、M4、M6。
M7、M8 在两种粒度中都作为历史总量输出。所有响应带 `Cache-Control: no-store`。日期范围
上限 366 天，避免单次请求遍历过多 KV。报表只读取固定分片 key，不遍历逐装机记录。

## 实现计划

- [x] 文档：本 spec、ADR-0019 / ADR-0020、glossary / roadmap / architecture / README 隐私段落与索引。
- [x] 文档：ADR-0023、M1～M8 与 HLL 固定分片设计，索引 / 路线图 / 架构 / 开发文档同步。
- [x] 客户端：`telemetry` 模块、事件构造、延迟上报、跨日心跳、限频重试。
- [x] 设置与持久化：`analyticsEnabled`、`installId`、`installFirstLaunchDay` 等字段与默认值合并。
- [x] 前端：设置页「帮助改进 BreakTimer-new」卡片（开关与说明）；不发送启动通知。
- [x] i18n：中英文全部新增文案。
- [x] 测试：字段白名单断言、日期校验、身份持久化与前端开关。
- [x] 服务端：EdgeOne Edge Function、HLL 写入、M1～M8 聚合报表、CSV 导出与 Node 测试；
      删除旧 Worker + D1 代码。端点已部署并完成路由、KV 绑定、请求体读取核验
      （见「部署核验记录（2026-11-13）」）。
- [x] 临时屏蔽：客户端上报总开关关闭，暂停请求与设置页统计卡片；待服务端部署后打开。
- [ ] 人工验收：抓包、断网补报、关闭开关、便携版与安装版、重放、M1～M8 导出、
      平台日志/域名/区域/KV 绑定核验。
- [ ] 收尾：更新 spec 状态、`docs/specs/README.md` 与 `docs/roadmap.md`。

## 开放问题

| # | 问题 | 备选与影响 |
| --- | --- | --- |
| Q1 | 服务端选型 | 已定：EdgeOne Pages / Makers Edge Functions + KV（ADR-0023，部分取代 ADR-0019） |
| Q2 | 报表形式 | 已定：维护令牌保护的 JSON/CSV；不再使用 SQL |
| Q3 | 域名与区域 | 待确认：可绑定的自定义域名、是否备案、中国大陆/全球含大陆/全球不含大陆节点、WAF |
| Q4 | 平台日志 | 待部署核验：自动访问日志是否含 IP、字段与保留期、KV 中心存储区域 |
| Q5 | KV 绑定形式 | 已关：官方技能包明确 KV 是控制台绑定的**全局变量**、不在 `context.env`；线上 `POST /v1/collect` 返回 `204` 与之一致。代码改为全局优先，`context.env` 仅作本机测试回退 |
| Q6 | 容量归档 | 当前不清理；KV 用量达到免费额度 80% 时另立需求评估历史草图归档 |
| Q7 | 共享模块路由 | 已关：官方约定 `_` 前缀文件为内部模块、不参与路由；线上 `/_lib/*` 与 `/edge-functions/*` 均返回 `404`，与约定一致 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-02 | 创建并确认：装机口径、默认开启、字段白名单、合规要求、留存与版本分布；服务端选型待定 |
| 2026-11-02 | 服务端选型定为 Cloudflare Worker + D1（ADR-0019），状态转 `in-progress`，开始实现 |
| 2026-11-03 | 将部署与 Windows 人工验收步骤归档到本 spec，移除对 `.ai/sessions/` 的依赖（ADR-0021） |
| 2026-11-05 | Cloudflare 路线不通；按 ADR-0023 改用 EdgeOne Edge Functions + KV HLL 近似聚合。指标收窄为 M1～M8，删除逐装机事实键、随机分片、留存、安装形态占比与 SQL 报表；需求与验收重新确认 |
| 2026-11-07 | 服务端端点尚未部署，客户端上报增加构建期总开关并暂时关闭；暂停期间不发请求、不显示设置页统计卡片，部署完成后打开开关恢复 |
| 2026-11-11 | 确认上报关闭将长期保持：`v1.0.0` 及后续版本继续不带客户端上报，待端点部署后再单独评估启用（不阻塞发版） |
| 2026-11-13 | 端点部署到 EdgeOne Makers 并核验：路由、静态输出目录、`context.env` 注入、KV 全局绑定、`_lib/` 不暴露；修复平台 `request.body` 恒为空、请求体只在 `text()` 可见导致的 `400 invalid JSON` |
| 2026-11-13 | 按官方技能包 `edgeone-makers-tools` 复核实现：更正「KV 兼容 `context.env`」与「`edgeone.json` 仅支持 headers」两处表述，`getKv` 改为全局变量优先并补 `test/runtime.test.mjs`；`/api/report` 的 KV 读取改为分批并发（366 天约 1.76 万次读不再串行） |
| 2026-11-13 | 补记带令牌 `/api/report` 核对结果：M1/M3，以及 `install` 后的 M5/M7/M8 均与预期一致；确认写入后立即读取会因 60 秒最终一致读到空草图；记录测试 key 残留与复位方式 |
