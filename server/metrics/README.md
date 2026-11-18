# 客户端统计服务（EdgeOne Pages / Makers Edge Functions + KV HLL）

对应 SPEC-0018、SPEC-0022、SPEC-0025、ADR-0023、ADR-0029 与 ADR-0033。服务只接收应用发出的
匿名 `install` / `heartbeat` 事件，把 `installId` 转换为 HyperLogLog 草图，输出下列 V2
近似聚合：

- 日活跃客户端；
- 日活跃版本、渠道和 OS 分布；
- 日新增客户端与新增渠道分布；
- 7/30/90 天趋势、平均日活、峰值日活和范围内新增客户端。

不保存逐客户端明细、明文 `installId`、IP、用户名、硬件信息或使用内容。统计域名同时提供
无需登录的公开客户端统计看板；维护者任意日期查询仍由维护令牌保护。

供外部 AI 或工程师评审的存储模型、算法、容量、当前缺陷与替代方向见
[`docs/client-metrics-server-review.md`](../../docs/client-metrics-server-review.md)。

## 组成

| 文件 | 作用 |
| --- | --- |
| `edge-functions/v1/collect.js` | `/v1/collect` 路由：仅允许 POST，校验、HLL 合并、KV 写入 |
| `edge-functions/api/report.js` | `/api/report` 路由：仅允许 GET，维护令牌鉴权、任意日期、V2 JSON/CSV |
| `edge-functions/api/public-report.js` | `/api/public-report` 路由：固定 7/30/90 天公开日报表 |
| `edge-functions/_lib/*.js` | 校验、HLL、key、运行时、写入、报表、公开缓存与结构化日志 |
| `test/*.test.mjs` | `node --test`，覆盖校验、HLL、写入、报表、缓存、隐私与看板 |
| `public/dashboard/` | 公开客户端统计看板 HTML/CSS/JS 与本地 SVG |
| `public/robots.txt` | 静态输出目录中的抓取限制 |
| `edgeone.json` | 路由安全头与缓存策略 |
| `.env.example` | 环境变量示例；真实值只在 EdgeOne 控制台配置 |

## 部署

1. 在 EdgeOne 控制台创建 Makers 项目，关联仓库。根目录填 `server/metrics`，生产分支使用
   `develop`，输出目录填 `public`；构建命令与安装命令留空，平台必填时填 `echo skip`。
2. 开通 KV Namespace，并以全局变量名 `METRICS_KV` 绑定到项目。代码优先读取全局
   `METRICS_KV`，`context.METRICS_KV` / `context.env.METRICS_KV` 只作为本地测试回退。
3. 配置项目环境变量：`DISABLED=0`、`MAINTENANCE_TOKEN=<随机强令牌>`。
4. 绑定稳定的自定义 HTTPS 域名；在发布构建中设置
   `BREAKTIMER_METRICS_URL=https://<metrics-domain>/v1/collect`。
5. 部署后验证 `/dashboard/`、`/api/public-report`、`/v1/collect` 和受保护的
   `/api/report`。V2 已于 2026-11-18 部署到 `metrics.hunhun.qd.je`。

## KV 结构

EdgeOne KV key 只允许字母、数字与下划线。日期写成 `YYYYMMDD`，HLL 固定 16 分片
`00..15`，精度 `p=14`（16384 个 5-bit 寄存器）。

| Key | Value | 写路径 |
| --- | --- | --- |
| `h_act_YYYYMMDD_shard` | 单个 HLL 草图 | `install` 与 `heartbeat` |
| `h_ver_YYYYMMDD_shard` | `{ versions, channels, os }` 三维草图 map | 两类事件按当前版本/渠道/OS 合并 |
| `h_newch_YYYYMMDD_shard` | 渠道 -> HLL 草图 map，日期为 `firstLaunchDay` | 仅 `install` |

心跳为 2 次 `get` / 合并 / `put`，安装为 3 次。每个有事件的自然日最多 48 个 key；
V2 没有全局 key：

```text
7d  = 7  × 3 × 16 = 336
30d = 30 × 3 × 16 = 1,440
90d = 90 × 3 × 16 = 4,320
```

V1 的理论值还包含 32 个全局 key，因此分别为 368 / 1,472 / 4,352。旧
`h_total_*`、`h_install_ver_*`、`h_new_*` 不再读取或写入；旧 `h_ver` 若是裸版本 map，
仍按 `versions` 兼容读取。历史 key 不自动迁移或删除。历史渠道/OS 无法重建，报表返回空
map，不伪造零值条目。

写入路径为逐 key `get` → 合并 → `await put`。重复 `installId` 对 HLL 幂等，但 KV 无事务
或 CAS，同一分片并发写入仍可能丢失一次更新并低估。客户端覆盖升级保留 `installId`，
所以不会重复增加日活或新增客户端。

## 上报协议

`POST /v1/collect` 请求体上限 2 KB，当前字段只有：

```text
schema
event
installId
day
firstLaunchDay
version
os
arch
locale
channel
```

`firstLaunchDay` 只出现在 `install`。首次安装与每日心跳是两个独立 HTTP 请求；安装请求会
同时写入当天 `h_act`，客户端无需额外补发活跃。服务端拒绝未知字段，不读取或记录 IP、
Cookie、完整请求头和请求体。

`day` 只接受服务端当天 ±1 天；`install.firstLaunchDay` 允许最近 730 天离线补报，且不得
晚于 `day`。统计停用时设置 `DISABLED=1`，端点返回 `410`，客户端静默失败。

## 报表

### 公开看板

看板位于 `https://<metrics-domain>/dashboard/`，不需要登录、Cookie 或 `Authorization`。
页面只请求同源 `GET /api/public-report`：

```text
range=7d|30d|90d
granularity=day
```

`range` 默认 `30d`；`granularity` 缺省或 `day`，月粒度返回 `400`。成功响应
`Cache-Control: public, max-age=60, s-maxage=60`，错误为 `no-store`。Cache API 名称为
`public-report-v2`，只缓存成功 200。

公开接口先用 `kv.list({ prefix: "h_act_", limit: 1 })` 探测，空 namespace 返回完整全零
日报表。非空时只列举范围内每天三个 V2 前缀，再 get 列表中的实际 key；并发上限 8。

响应结构：

```json
{
  "approximate": true,
  "method": "hll",
  "consistency": "eventual_60s",
  "range": "30d",
  "granularity": "day",
  "from": "2026-10-20",
  "to": "2026-11-18",
  "generatedDay": "2026-11-18",
  "summary": {
    "activeAverage": 82.4,
    "activePeak": 117,
    "newClients": 23
  },
  "rows": [
    {
      "date": "2026-11-18",
      "active": 91,
      "versionsActive": { "0.1.2": 80 },
      "channelsActive": { "installer": 60, "portable": 31 },
      "osActive": { "windows-11": 88 },
      "newClientsByChannel": { "installer": 2, "portable": 1 }
    }
  ]
}
```

`activeAverage` 是逐日估计的算术平均值并保留一位小数；`activePeak` 是最大日估计；
`newClients` 合并范围内所有渠道 HLL 后估计并集，不直接累加渠道数。

### 私有报表

`GET /api/report` 继续要求
`Authorization: Bearer $MAINTENANCE_TOKEN`，支持任意日期范围（最多 366 天）和
`format=json|csv`，响应 `no-store`：

```powershell
$headers = @{ Authorization = "Bearer $env:MAINTENANCE_TOKEN" }
Invoke-RestMethod `
  -Uri "https://<metrics-domain>/api/report?from=2026-11-01&to=2026-11-30&format=json" `
  -Headers $headers
```

私有报表按范围内每天 3 个维度 × 16 分片盲读，不调用 `kv.list`。`granularity=month`
返回 `400`。

## 日志

三条函数入口通过 `_lib/log.js` 输出 `breaktimer-metrics` 前缀的单行 JSON 日志。字段包括
阶段、结果、状态、耗时和对应聚合计数；日志不得包含 `installId`、IP/GEO、Cookie、
`Authorization`、完整请求头、请求体、维护令牌或 KV 原始 value。UUID、IP、Bearer 凭据与
令牌参数会统一脱敏，logger 抛错不改变业务响应。

推荐检索：`breaktimer-metrics`、`"outcome":"error"`、`"stage":"kv_write"`、
`"emptyNamespace":true`、`"cache":"hit"`。

## 测试

```powershell
cd server/metrics
npm test
```

本地内存 KV 覆盖空 namespace、真实前缀、分页、缓存、并发、隐私和响应契约。测试不访问
EdgeOne 或网络，也不替代部署后的控制台与公网核验。

2026-11-18 线上核验：公开接口已返回 V2 summary/row，月粒度返回 `400`，看板已渲染客户端
统计。首次 TTFB 约为 7d `2.73s`、30d `6.51s`、90d `14.83s`；7d 短时重复请求仍约
`2.96s`，Cache API 命中与长范围读取成本仍需继续观察。

## 平台差异

- `context.request.body` 在 EdgeOne 上可能是空 `ReadableStream`，请求体只通过
  `request.text()` 暴露；写入读取优先调用 `text()`。
- KV 是控制台绑定的全局变量，不在 `context.env`；环境变量路径只用于本地回退。
- `_` 前缀模块不参与路由，线上 `/_lib/*` 与 `/edge-functions/*` 返回 `404`。
- `URLSearchParams` 支持 `keys()` / `get()`，不支持条目迭代；公开参数解析保留回归测试。
- 路由级 `Cache-Control` 会覆盖函数响应头，因此 `/api/public-report` 不在
  `edgeone.json` 中设置该头。
- EdgeOne 空 list 页可能返回 `{ complete: true, cursor: "" }` 并省略 `keys`；非空分页
  必须按 `cursor` 读到底，列表条目 key 名从 `key` 字段读取。
- KV 写入后有约 60 秒不可见窗口；报表读不到最新值不等于写入失败。
