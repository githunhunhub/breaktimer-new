# SPEC-0018：客户端统计（Client Metrics V2）

- 状态：in-progress
- 日期：2026-11-02
- 最近更新：2026-11-18
- 关联：ADR-0019 · ADR-0020 · ADR-0023 · ADR-0029 · ADR-0033 · SPEC-0010 · SPEC-0012 · SPEC-0014 · SPEC-0017 · SPEC-0022 · SPEC-0025

## 背景 / 问题

应用没有账号体系，能稳定统计的最小单位是一份独立客户端实例：一份独立运行数据目录和本地
生成的随机 `installId`。项目作者不需要精确日活或精确新增，也不需要逐客户端明细；只需要
足以判断活跃趋势、版本采用、分发渠道和 OS 构成、新增趋势的近似数据。

服务端继续使用 EdgeOne Pages / Makers Edge Functions + KV 与 HyperLogLog（HLL）草图。
本版把原“装机统计 M1～M8”收敛为“客户端统计 V2”，删除累计、月粒度和跨日活跃去重汇总，
减少全局 key、查询分支和看板标签，不重构客户端上报协议。

## 指标范围

V2 输出以下指标：

| 指标 | 口径 |
| --- | --- |
| 日活跃客户端 | 客户端本地自然日内收到 `install` 或 `heartbeat` 的 `installId` 去重估计；首装当天计入活跃 |
| 日活跃版本分布 | 当日事件 `version` 分组后的去重客户端估计 |
| 日活跃渠道分布 | 当日事件 `channel` 分组后的去重客户端估计 |
| 日活跃 OS 分布 | 当日事件 `os` 分组后的去重客户端估计 |
| 日新增客户端 | `install` 按客户端 `firstLaunchDay` 归日、合并渠道草图后的去重估计 |
| 新增客户端渠道分布 | `install` 按 `firstLaunchDay` 和 `channel` 分组后的去重估计 |
| 趋势与汇总 | 最近 7/30/90 天逐日趋势，以及平均日活、峰值日活和范围内新增客户端 |

所有报表输出固定带有：

```json
{
  "approximate": true,
  "method": "hll",
  "consistency": "eventual_60s"
}
```

不再输出 M1～M8 编号、月指标、累计装机、累计版本装机、留存、版本迁移或跨日去重活跃汇总。
不再要求“精确日活”或“精确新增”。所有值都是趋势估计，不是自然人数量。

## 口径与客户端事实

| 名词 | 定义 |
| --- | --- |
| 客户端实例 | 一份独立运行数据目录（安装版 `%APPDATA%\com.githunhunhub.breaktimernew`，便携版 `data\`）及其随机 `installId` |
| 活跃客户端 | 指定自然日有 `install` 或 `heartbeat` 的去重客户端估计 |
| 新增客户端 | 首次 `install` 按 `firstLaunchDay` 归日的去重客户端估计 |
| HLL 草图 | 由 `installId` 哈希派生的寄存器数组，可估计基数、可合并，不能还原明细 |
| 分发量 | GitHub Release `download_count` 与网盘后台下载量，和客户端实例数不是同一口径 |

必须明确的事实：

- 安装版覆盖升级、保留 AppData 的卸载重装不会生成新的 `installId`，因此不会重复增加活跃或
  新增客户端。手动清理数据目录后重装才会生成新 ID。
- 便携版整目录复制会共用同一个 `installId`，属于已知低估；重新解压出新的 `data\` 会产生
  新客户端。
- HLL 对重复 `installId` 幂等；同一客户端同日重复 `install` / `heartbeat` 不会重复增长。
- 客户端跨日运行并升级时，同一客户端可以在不同日期的版本分布中分别出现；日活跃总数不会
  因版本不同重复计算。
- 首次安装与每日心跳目前是两个独立 HTTP 请求。`install` 请求本身已经同时写入当天活跃，
  不需要客户端再补一个“首装当天活跃”请求。
- HLL 约有 1～3% 相对误差；KV 60 秒最终一致，并发读改写可能丢失一次更新并倾向低估。

## 客户端上报

客户端行为保持不变。发布构建受 `REPORTING_SWITCH` 与 `BREAKTIMER_METRICS_URL` 共同控制；
开发构建、测试与 CI 不上报。

当前白名单字段只有：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schema` | int | 上报协议版本，当前为 `1` |
| `event` | enum | `install` / `heartbeat` |
| `installId` | UUID string | 本地随机 UUIDv4；服务端只保留哈希草图 |
| `day` | `YYYY-MM-DD` | 事件发生的客户端本地日期 |
| `firstLaunchDay` | `YYYY-MM-DD` | 仅 `install`；首次生成 ID 的日期 |
| `version` | string | 应用版本 |
| `os` | enum | 粗分类，如 `windows-10` / `windows-11` |
| `arch` | enum | 架构，如 `x64` |
| `locale` | string | 有效语言标签 |
| `channel` | enum | `installer` / `portable` |

禁止上报原始 IP、地理位置、时区、精确时间戳、用户名、主机名、硬件指纹、安装路径、进程
列表、窗口标题、休息内容、设置全文、崩溃内容、Cookie 或账号信息。请求体上限 2 KB。

## 服务端存储

KV key 只允许字母、数字与下划线。日期使用 `YYYYMMDD`，固定 16 个分片，`shard=00..15`。
`installId` 的 SHA-256 低位决定分片，HLL 精度 `p=14`（16384 个 5-bit 寄存器）。

| 数据 | Key | Value | 写入事件 |
| --- | --- | --- | --- |
| 日活跃 | `h_act_<day>_<shard>` | 单个 HLL 草图 | `install` / `heartbeat` |
| 日活跃三维分布 | `h_ver_<day>_<shard>` | `{ "versions": map, "channels": map, "os": map }` | 两类事件都按当前事件字段合并 |
| 新增客户端渠道 | `h_newch_<firstLaunchDay>_<shard>` | `{ "installer": HLL, "portable": HLL }` | 仅 `install` |

每个有事件的自然日最多 48 个 key，没有全局 key。HLL 的合并规则是逐寄存器取最大值。

兼容规则：

- 旧 `h_ver` value 若是 `{ "<version>": HLL }` 裸 map，按 `versions` 读取；
- 旧 `h_new_*`、`h_total_*`、`h_install_ver_*` 不读取、不写入；
- 历史 key 不自动删除或迁移；缺失的渠道/OS 维度输出 `{}`；
- 写入失败返回 `500` 让客户端静默重试，重复上报保持幂等。

## 报表接口

### 私有报表

```text
GET /api/report?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv
Authorization: Bearer <MAINTENANCE_TOKEN>
```

- 支持任意日期范围，上限 366 天；
- `granularity` 缺省或为 `day`；`month` 返回 `400`；
- JSON 输出固定元数据、范围、`generatedDay`、`summary` 和逐日 `rows`；
- CSV 输出 `date`、`active`、`versions_active`、`channels_active`、`os_active`、
  `new_clients_by_channel` 及固定元数据列；
- 报表只盲读范围内的 3 个日维度 × 16 分片，不调用 `kv.list`；
- 响应 `Cache-Control: no-store`。

逐日 row：

```json
{
  "date": "2026-11-18",
  "active": 123,
  "versionsActive": { "0.1.2": 100 },
  "channelsActive": { "installer": 80, "portable": 43 },
  "osActive": { "windows-11": 110 },
  "newClientsByChannel": { "installer": 3, "portable": 1 }
}
```

范围 summary：

```json
{
  "activeAverage": 101.3,
  "activePeak": 140,
  "newClients": 12
}
```

- `activeAverage` 是逐日活跃估计的算术平均值，保留一位小数；
- `activePeak` 是逐日活跃估计的最大值；
- `newClients` 合并范围内所有渠道 HLL 后估计并集，不直接累加渠道值。

### 公开报表

```text
GET /api/public-report?range=7d|30d|90d[&granularity=day]
```

- 默认 `range=30d`，只允许 7/30/90 天；
- `granularity` 仅允许缺省或 `day`，月粒度返回 `400`；
- 响应始终为 `granularity="day"`，字段与私有 JSON 相同，不包含逐客户端明细；
- 成功响应缓存 60 秒，Cache API 名为 `public-report-v2`；错误为 `no-store`；
- 先做空 namespace 探测，之后只列举日期范围内的 `h_act_`、`h_ver_`、`h_newch_` 前缀；
- 只读取 `kv.list` 返回的实际 key，并发上限 8，不列举全局或旧 `h_new_` key。

## 日志与隐私

`/v1/collect`、`/api/report`、`/api/public-report` 继续输出
`breaktimer-metrics` 前缀的单行 JSON 诊断日志，至少包含阶段、结果、状态、耗时和对应业务
计数。日志不得记录 `installId`、IP/GEO、Cookie、`Authorization`、完整请求头、请求体、
维护令牌或 KV 原始 value；UUID、IP、Bearer 凭据与令牌参数统一脱敏。

平台自动访问日志字段、保留期、KV 区域、WAF 与域名加速区域仍需在部署前核验。历史草图
当前不清理；KV 用量达到免费额度 80% 时另立需求评估保留期和归档。

## 验收标准

- [x] **I1** 覆盖升级保持 `installId`；重放相同 `install` / `heartbeat` 不增加 HLL 估计。
- [x] **I2** `install` 同时计入当天活跃，并写 `h_newch_<firstLaunchDay>`；心跳只写活跃和三维分布。
- [x] **I3** 心跳恰好写 2 个 key，安装恰好写 3 个 key；任何路径都不写 `h_new`、
      `h_total_` 或 `h_install_ver_`。
- [x] **I4** `h_ver` 同时保存版本、渠道、OS 三维；旧裸版本 map 仍按版本维度读取。
- [x] **I5** 新增客户端按 `firstLaunchDay` 和 `channel` 分组；范围内 summary 使用 HLL 并集。
- [x] **I6** 私有报表拒绝 `granularity=month`，支持任意日期、JSON/CSV 和 `no-store`。
- [x] **I7** 公开报表只接受 7/30/90 天和日粒度，响应字段、summary 与 row 符合本 spec。
- [x] **I8** 公开报表只列举 `h_act_`、`h_ver_`、`h_newch_` 前缀，不读取旧全局或 `h_new_` key。
- [x] **I9** 空 namespace 返回完整全零报表；Cache API 命中时不访问 KV，60 秒后失效。
- [x] **I10** JSON、CSV、日志和看板不包含明文 `installId`、IP、令牌或逐客户端记录。
- [x] **I11** 看板使用“客户端统计”名称，只显示 V2 指标，不出现月份切换或 M1～M8。
- [x] **I12** 桌面端与移动端无横向溢出、文字遮挡；加载、空数据、失败重试和 HLL 说明齐备。
- [x] **I13** `server/metrics/npm test` 与 `app/pnpm verify` 全部通过。
- [x] **I14** SPEC、ADR、索引、架构、路线图、README 与外部评审说明同步。

## 历史部署记录

端点已于 2026-11-13 部署到 EdgeOne Makers，以下结论继续有效：

| 项 | 结论 |
| --- | --- |
| `GET /robots.txt` | `200`，静态输出目录 `public` 生效 |
| `GET /v1/collect` | `405`，路由挂在域名根层 |
| `GET /api/report`（无令牌） | `401`，维护令牌已注入 |
| `/_lib/*`、`/edge-functions/*` | `404`，内部模块未暴露 |
| `POST /v1/collect` | `204`，KV 全局绑定可用 |
| KV 写入后立即读取 | 出现过短暂空值，约 60 秒后恢复，符合 `eventual_60s` |

旧部署记录中的 M1～M8 与 `h_total_*` / `h_install_ver_*` 相关测试结果属于 V1 历史事实，
不再代表 V2 当前口径。V2 尚未部署；部署后需重新核验 7/30/90 天公开报表、私有报表、
三维 `h_ver`、`h_newch` 和 Cache API 名称。

## 设计要点

- 客户端 `app/src-tauri/src/telemetry/` 不因 V2 改动；`install` 与 `heartbeat` 的现有字段
  足以生成全部 V2 指标。
- `h_ver` 的三个 map 共用同一 key，减少写入次数；版本/渠道/OS 字符串只在受校验 value 中，
  不进入 key。
- 旧裸版本 map 通过 shape detection 兼容，不迁移线上 key。历史渠道/OS 不可重建，按空 map
  返回。
- 私有报表保持固定分片盲读，便于测试和任意日期查询；公开报表保留真实前缀列举和 60 秒缓存，
  避免稀疏数据下读取理论不存在的分片。
- 看板不做跨日活跃去重汇总；版本、渠道、OS 分布展示最新日数据，新增渠道分布展示范围内
  按首次启动日归集的数据。逐日明细保留完整维度。

## 实现计划

- [x] 文档：重写 SPEC-0018/0022/0025，生成外部评审说明，新增 ADR-0033 并同步索引。
- [x] 测试：先改 HLL、key、collect、report、public-report、dashboard 测试并确认 RED。
- [x] 服务端：三维 `h_ver`、`h_newch`、2/3 次写入及 V2 报表读取。
- [x] 公开接口：固定日粒度、V2 前缀、`public-report-v2` 缓存。
- [x] 看板：客户端统计名称、三项概览、两类趋势、四类分布和日明细。
- [x] 验证：`server/metrics/npm test` 与 `app/pnpm verify` 通过；桌面和窄屏移动布局使用
      本地 mock 数据完成截图检查。

## 开放问题

| # | 问题 | 结论 |
| --- | --- | --- |
| Q1 | 是否需要精确日活/新增 | 不需要；接受 HLL 近似与 KV 最终一致 |
| Q2 | 是否保留月粒度与累计 | 不保留；月、累计、累计版本均移出当前口径 |
| Q3 | 首装是否需客户端再发一次活跃 | 不需要；`install` 已同时写当天活跃 |
| Q4 | 是否迁移旧 key | 不迁移；兼容旧 `h_ver` 版本 map，其余旧 key 忽略 |
| Q5 | 是否更换存储 | 不更换；继续固定 16 分片 EdgeOne KV + HLL |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-18 | 收敛为客户端统计 V2：删除 M1～M8、月粒度、累计与全局 key；新增三维 `h_ver`、`h_newch`、V2 报表与看板契约 |
| 2026-11-16 | 增加服务端结构化诊断日志与敏感信息脱敏 |
| 2026-11-13 | EdgeOne 端点部署与平台差异核验；记录 V1 M1～M8 线上验证结果 |
| 2026-11-05 | 改用 EdgeOne KV + HLL，指标收敛为 M1～M8 |
| 2026-11-02 | 创建匿名装机统计需求、字段白名单与合规边界 |
