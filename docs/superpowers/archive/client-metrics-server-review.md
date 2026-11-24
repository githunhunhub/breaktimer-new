# 客户端统计服务端存储与算法说明

> 用途：自包含说明当前客户端统计 V2 的服务端存储、写入路径、读取路径、指标口径、容量与
> 已知取舍，便于其他 AI 或工程师评审是否有更合适的实现方案。
>
> 需求与验收以 [SPEC-0018](../specs/0018-installation-metrics.md)、
> [SPEC-0022](../specs/0022-public-metrics-dashboard.md)、
> [SPEC-0025](../specs/0025-public-report-read-performance.md) 为准；长期取舍见
> [当前决策记录](../../log/decisions.md)。

## 1. 结论先行

当前方案不保存每次安装、每个活跃日或逐客户端明细，而是把随机 `installId` 哈希成
HyperLogLog（HLL）寄存器更新，写入 EdgeOne KV 的固定 16 分片草图。

相同 `installId` 重复上报只会重复写入同一个寄存器值，因此 HLL 估计不会重复增长。日活跃、
版本/渠道/OS 分布和新增渠道均由少量可合并草图推导。

方案特征：

- key 数量与客户端数量无关，只随日期、固定分片和实际维度增长；
- 不保存明文 `installId`、逐客户端事件或可还原列表；
- 日草图可合并，但 V2 不再输出跨日去重活跃汇总、月指标或累计指标；
- 代价是 HLL 近似误差、KV 最终一致性，以及无事务/CAS 时并发读改写可能丢失更新；
- 查询公开报表时优先使用 60 秒 Cache API，未命中才列举并读取实际存在的 key。

需要外部评审重点比较的问题：

1. `p=14`、16 分片和十六进制 JSON 编码是否适合当前及预期规模；
2. KV 无原子合并导致的并发低估是否可接受，是否需要 CAS、队列或单写者；
3. 三维 `h_ver` map 随版本、渠道、OS 数量增长的写放大是否可接受；
4. 公开报表的 3 个日前缀列举与 60 秒缓存是否优于定时预聚合；
5. 私有报表固定分片盲读的扇出是否需要同步优化；
6. 是否值得引入数据库或 append-only 事件归档换取精确性和可重算能力。

## 2. 先回答三个常见问题

### 2.1 客户端升级会导致重复计算吗？

正常情况下不会。

- 覆盖升级保留本地 `installId`，不会生成新的客户端实例。
- HLL 更新对同一 `installId` 幂等，重复 `install` / `heartbeat` 不会让同一个日草图增加基数。
- 升级后的新版本心跳只会在新日期的版本分布中记录新版本；不会把日活跃总数重复计算。
- 因为 V2 删除累计指标，也不存在“同一客户端被多个版本累计草图重复统计”的口径。
- 如果用户手动删除数据目录再安装，会生成新的 `installId`，这在口径上就是一次新的客户端
  实例；它不是升级重复计算。
- 便携版整目录复制到其他机器仍共用同一个 `installId`，会低估而不是重复计算。

并发写入仍可能让两个不同客户端更新同一分片时丢失一次寄存器更新，这是低概率低估，与升级
重复统计是不同问题。

### 2.2 首次安装数据和每日 heartbeat 是一起发送还是分开？

目前是两个独立 HTTP 请求：

1. 首次安装成功后发送 `event="install"`；
2. 每个自然日最多发送一次 `event="heartbeat"`。

`install` 请求本身会同时写入：

- 当天 `h_act_<day>`；
- 当天三维 `h_ver_<day>`；
- `firstLaunchDay` 对应的 `h_newch_<firstLaunchDay>`。

因此不需要客户端为“首装当天也算活跃”再发送一个额外请求。安装当天如果随后又发送心跳，
HLL 会对同一 `installId` 去重。

### 2.3 当前上报字段有哪些？

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

说明：

| 字段 | 取值/用途 |
| --- | --- |
| `schema` | 当前为 `1` |
| `event` | `install` / `heartbeat` |
| `installId` | 客户端本地随机 UUIDv4 |
| `day` | 事件发生的客户端本地日期 |
| `firstLaunchDay` | 仅安装事件；首次生成 ID 的日期 |
| `version` | 应用版本 |
| `os` | Windows 10 / 11 等粗分类 |
| `arch` | `x64` 等架构 |
| `locale` | `zh-CN` / `en-US` 等有效语言标签 |
| `channel` | `installer` / `portable` |

请求体上限 2 KB，未知字段直接拒绝。服务端不读取 IP/GEO，不记录请求体、明文 `installId`、
Cookie 或完整请求头。

## 3. V2 指标口径

| 指标 | 服务端推导 |
| --- | --- |
| 日活跃客户端 | 当日 `h_act` 的 16 个分片草图合并后估算 |
| 日活跃版本分布 | 当日 `h_ver.versions[version]` 的 16 分片合并后估算 |
| 日活跃渠道分布 | 当日 `h_ver.channels[channel]` 合并后估算 |
| 日活跃 OS 分布 | 当日 `h_ver.os[os]` 合并后估算 |
| 日新增客户端 | `h_newch[day]` 下各渠道草图合并后估算 |
| 新增客户端渠道分布 | `h_newch[day][channel]` 分别合并估算 |
| 平均日活 | 范围内每日活跃估计的算术平均值，保留一位小数 |
| 峰值日活 | 范围内每日活跃估计的最大值 |
| 范围新增客户端 | 合并范围内全部新增渠道草图后估算并集，不累加渠道估计 |

版本、渠道、OS 分布不是互斥占比，也不能把各分组值相加当作总体去重活跃。一个客户端在同一
天的版本、渠道、OS 各只能落在一个分组中；跨日升级时可在不同日期属于不同版本。

## 4. KV 存储结构

EdgeOne KV key 只允许字母、数字和下划线。日期使用 `YYYYMMDD`，分片使用 `00..15`。

| 数据 | Key | Value |
| --- | --- | --- |
| 日活跃 | `h_act_<YYYYMMDD>_<shard>` | 单个 HLL 草图 JSON |
| 日版本/渠道/OS | `h_ver_<YYYYMMDD>_<shard>` | `{ "versions": map, "channels": map, "os": map }` |
| 日新增渠道 | `h_newch_<firstLaunchDay>_<shard>` | `{ "<channel>": HLL }` |

`h_ver` 示例：

```json
{
  "versions": {
    "0.1.2": "{\"p\":14,\"data\":\"...\"}"
  },
  "channels": {
    "installer": "{\"p\":14,\"data\":\"...\"}",
    "portable": "{\"p\":14,\"data\":\"...\"}"
  },
  "os": {
    "windows-11": "{\"p\":14,\"data\":\"...\"}"
  }
}
```

实际实现中，map 内每个值可以是已解析对象或字符串形式；持久化统一序列化为字符串草图。
文档中的嵌套字符串只是为了说明“map 的值仍是一张 HLL”。

旧 `h_ver` value 若是：

```json
{
  "0.1.1": "{\"p\":14,\"data\":\"...\"}"
}
```

则按 `{ versions: 该 map, channels: {}, os: {} }` 读取。旧 `h_new_*`、`h_total_*`、
`h_install_ver_*` 不读取也不写入；不自动删除或迁移。

## 5. HLL 算法

### 5.1 精度与编码

- 精度 `p=14`，寄存器数 `m=2^14=16384`；
- 每个寄存器 5 bit，8 个寄存器打包成 5 字节；
- 单草图固定编码为 20,480 个十六进制字符；
- JSON 包装还包含 `p` 与 `data` 字段，单草图通常约 20 KiB。

### 5.2 `installId` 映射

1. 对 `installId` 做 SHA-256；
2. 从摘要中取低位确定 16 个固定分片之一；
3. 取另一段 32 位作为 HLL 输入；
4. 低 14 位确定寄存器索引；
5. 其余位计算前导零 rank，并限制在 1..31；
6. 寄存器取 `max(old, rank)`。

同一 ID 每次都映射到同一分片和寄存器，因此重复事件幂等。不同客户端若落入同一分片，会更新
同一草图的不同或相同寄存器。

### 5.3 合并与估计

多张草图合并为逐寄存器取最大值。基数估计使用标准 HLL 公式，并在小基数时应用线性计数修正：

```text
raw = alpha * m^2 / sum(2^-register)
linear = m * ln(m / zeroRegisters)
```

零寄存器足够多且线性计数位于小范围阈值内时返回线性计数，否则返回原始估计。最终结果四舍五入，
公开说明约 1～3% 相对误差。

## 6. 写入路径

### 6.1 `heartbeat`

```text
h_act_<day>_<shard>   get -> merge ID -> put
h_ver_<day>_<shard>   get -> merge version/channel/os -> put
```

总计 2 个 key 的读取、合并和写回。

### 6.2 `install`

```text
h_act_<day>_<shard>          get -> merge ID -> put
h_ver_<day>_<shard>          get -> merge version/channel/os -> put
h_newch_<firstLaunchDay>_<shard> get -> merge channel -> put
```

总计 3 个 key。安装请求同时完成当天活跃，不需要额外请求。

### 6.3 失败语义

| 状态 | 含义 |
| --- | --- |
| `204` | 所有目标草图 `put` 成功 |
| `400` | JSON、字段、日期或枚举校验失败 |
| `410` | 统计端点停用 |
| `413` | 请求体超过 2 KB |
| `500` | KV 绑定、哈希或写入失败；客户端静默重试 |

写入串行执行并等待每个 `put` 完成。没有跨 key 原子性；部分维度失败时客户端会重试，已完成
的 HLL 合并保持幂等。

## 7. 读取路径

### 7.1 私有 `/api/report`

输入：

```text
from / to 任意日期，最多 366 天
format=json|csv
Authorization: Bearer <MAINTENANCE_TOKEN>
```

读取固定 16 分片，不调用 `kv.list`：

```text
rangeDays × 3 dimensions × 16 shards
```

7/30/90 天分别为 336 / 1,440 / 4,320 次 `get`。空 key 也计入读取，但逻辑简单，适合维护者
低频导出。

报表步骤：

1. 并行读取每天的 `active`、`h_ver`、`h_newch` 分片；
2. 每个维度按寄存器合并；
3. 将 group map 按分组名合并后估算；
4. 逐日生成 row；
5. summary 计算逐日活跃平均值/峰值，并用 HLL 并集估算范围新增；
6. 输出 JSON 或 CSV，带固定近似元数据和 `no-store`。

### 7.2 公开 `/api/public-report`

输入固定：

```text
range=7d|30d|90d
granularity=day
```

读取顺序：

1. 先查 Cache API `public-report-v2` 的规范化 `range + day` 键；
2. 命中 60 秒内成功响应则直接返回，不访问 KV；
3. 未命中时执行一次 `kv.list({ prefix: "h_act_", limit: 1 })` 探测空 namespace；
4. 空 namespace 直接返回完整全零日报表；
5. 非空时，为范围内每天分别列举 `h_act_`、`h_ver_`、`h_newch_`；
6. 列举结果按目标 key 过滤、去重；
7. 只对实际存在的 key 执行 `get`，并发上限 8；
8. 合并草图并构建响应；
9. 成功 200 写入 Cache API 60 秒，失败不缓存。

7/30/90 天理论列举前缀数为：

```text
1 次空探测 + 3 × rangeDays
7d  = 22
30d = 91
90d = 271
```

分页会增加 page 数，但 `get` 数等于实际命中的 key 数，而不是理论上限。

## 8. Key 数量与容量

### 8.1 理论 key 数

| 方案 | 每日 | 7 天 | 30 天 | 90 天 |
| --- | ---: | ---: | ---: | ---: |
| V1 当前（含 32 个全局 key） | 48 + 32 | 368 | 1,472 | 4,352 |
| V2 目标 | 48 | 336 | 1,440 | 4,320 |

V2 的节省来自删除：

```text
h_total_*
h_install_ver_*
```

这是理论上限。实际 KV 只创建至少收到一个事件的日期和分片 key。

### 8.2 数据量

以单版本、每分片每天都有数据、单草图约 20 KiB 估算：

```text
每天最多 48 × 20 KiB = 960 KiB ≈ 0.94 MiB
一年最多约 343 MiB
```

这是忽略稀疏性、压缩和 JSON 组装的对照值，不是实际用量。三维 map 中每增加一个版本、渠道
或 OS 值，会增加一张完整草图；单 value 仍需对照 EdgeOne 25 MB 上限和免费额度监控。

## 9. 一致性、误差与失败模式

| 来源 | 影响 | 当前处理 |
| --- | --- | --- |
| HLL 统计误差 | 单次估计有 1～3% 波动 | 输出 `approximate=true` |
| KV 并发读改写 | 同分片并发可能丢失一次更新，倾向低估 | 固定分片和启动抖动，无 CAS |
| 部分 key 写失败 | 某些维度成功、某些失败 | 返回 `500` 让客户端重试；无跨 key 原子性 |
| KV 最终一致 | 写入后约 60 秒仍可能读到旧值 | 输出 `consistency=eventual_60s` |
| 公开缓存 | 数据再延迟最多 60 秒 | 只缓存成功响应；显示缓存说明 |
| 便携目录复制 | 多份副本共用 `installId` | 已知低估，不引入设备指纹 |
| 无卸载回传 | 无法知道实例是否仍存在 | 不提供现存客户端数 |
| 历史维度缺失 | V1 只有版本，没有渠道/OS | 返回 `{}`，不伪造零值 |

## 10. 兼容与迁移边界

- 不迁移旧 key；V2 读写只覆盖三类日 key。
- 旧 `h_ver` 裸版本 map 读取兼容，避免丢失版本历史。
- 旧 `h_new_*`、`h_total_*`、`h_install_ver_*` 被忽略，不删除。
- 历史渠道/OS 无法从旧数据重建；上线后从空维度开始积累。
- 公开 Cache API 名称升级为 `public-report-v2`，避免把 V1 响应误认为 V2。
- 客户端协议不变，安装和心跳字段无需新增。
- 任何精确去重、留存、卸载回传或逐客户端查询都需要另立 SPEC/ADR。

## 11. 当前方案的优点

- 不保存逐客户端明细，隐私暴露面小于事实表方案。
- key 数不随客户端数线性增长。
- HLL 可合并，日活跃和分组分布可复用同一草图。
- 写入通常只涉及 2 或 3 个 key，适合边缘函数短请求。
- 公开接口在稀疏数据下只读取实际存在的 key，并可用缓存避免重复计算。
- V2 删除全局累计与月聚合，降低 key、接口和看板复杂度。

## 12. 已知弱点

- KV 无事务与 CAS，并发写同分片会丢失寄存器更新。
- 单草图是稠密固定长度，低基数也约占 20 KiB。
- `p=14`、16 分片和三维 map 放大读写字节数。
- 三维 map 每次更新重写该 key 下所有版本/渠道/OS 草图。
- 私有报表仍按理论分片盲读，366 天范围扇出很高。
- 历史数据没有自动归档或保留期策略。
- 报表是趋势估计，不适合审计、精确计费或留存分析。
- 实现与 EdgeOne KV 的最终一致、list 分页和全局绑定行为耦合。

## 13. 可供外部评审比较的方向

### 13.1 保留 HLL，降低编码和写放大

- 使用 sparse HLL / HLL++，低基数只保存非零寄存器；
- 降低 `p`，例如 `p=12` 草图约为四分之一、标准误约 1.63%；
- 使用 Base64 或二进制编码替代 20,480 字符十六进制；
- 将三维 map 拆成独立 key，减少整图重写；
- 减少分片或动态选择分片，权衡热 key 与存储放大。

需要回答：预期日活规模、可接受误差、低基数占比、EdgeOne CPU/值与 key 数成本。

### 13.2 引入具备事务或 CAS 的存储

候选：

- 支持原子 merge/update 的 Durable Object、数据库或键值服务；
- 单写者队列按 key 串行合并；
- KV 外增加写合并层，周期性 flush。

优点是消除同 key 丢失更新；代价是成本、部署复杂度、平台锁定和故障恢复语义增加。

### 13.3 append-only 事件归档 + 批量聚合

上报先写对象存储或日志，定时批处理生成日 HLL/报表；查询只读预聚合结果。

优点是写入简单、可重算、算法可回滚；代价是批处理、对象格式、重试、保留期和更严格的数据
合规设计。若保留逐事件，必须重新评估隐私。

### 13.4 公开报表预聚合快照

定时生成 7/30/90 天三份日报表快照，公开接口只读一个快照 key，动态计算作为回退。

优点是降低首次冷缓存读取；代价是定时任务、陈旧窗口、告警与额外存储。SPEC-0026 旧稿基于
V1 六种日月组合，已 superseded，不能按原文实施。

### 13.5 精确数据库方案

若需要精确日活、新增或严格渠道归属，通常至少要保存
`(installIdHash, day, dimension)` 级别的去重状态，或使用支持唯一约束/事务的数据库。

优点是口径清晰、可校验、可修复；代价是数据量、保留期、隐私边界、运维和查询成本上升，
并推翻当前“不保存逐客户端明细”的约束。

## 14. 建议评审重点

1. `p=14 + 16 分片 + 十六进制 JSON` 是否仍是当前规模下最合适的 HLL 形态？
2. 能否在不引入复杂基础设施的前提下，用 CAS、单写者或队列消除同 key 丢失更新？
3. 三维 `h_ver` map 的版本/渠道/OS 增长是否会显著放大写延迟和费用？
4. 公开报表的 3 个日前缀列举加 60 秒缓存是否优于预聚合快照？
5. 私有报表 366 天盲读是否需要改为列举、批处理或限制范围？
6. 历史 V1 key 的保留、归档或删除应采用什么策略？
7. 如果改用精确数据库/事件归档，隐私披露和跨境数据处理需要增加哪些约束？
8. 是否有更成熟的 HLL/HLL++ 序列化、sparse 或自适应精度实现可直接复用？

## 15. 代码与事实来源

| 内容 | 位置 |
| --- | --- |
| HLL 参数、哈希、编码、合并与估计 | `server/metrics/edge-functions/_lib/hll.js` |
| KV key 命名与固定分片 | `server/metrics/edge-functions/_lib/keys.js` |
| 上报校验与写入链路 | `server/metrics/edge-functions/_lib/collect.js`、`_lib/validate.js` |
| 私有报表读取与聚合 | `server/metrics/edge-functions/_lib/report.js` |
| 公开报表列举、缓存与稀疏读取 | `server/metrics/edge-functions/_lib/public-report.js` |
| 路由入口 | `server/metrics/edge-functions/v1/collect.js`、`api/report.js`、`api/public-report.js` |
| KV 绑定与运行时适配 | `server/metrics/edge-functions/_lib/runtime.js` |
| 部署与平台差异 | `server/metrics/README.md` |
| 需求与验收 | `docs/specs/0018-installation-metrics.md` |
| 公开接口与看板 | `docs/specs/0022-public-metrics-dashboard.md` |
| 稀疏读取性能 | `docs/specs/0025-public-report-read-performance.md` |
| V2 决策 | `docs/log/decisions.md` |

本文描述 `develop` 中本次 V2 重构后的代码与测试实现。V2 已于 2026-11-18 部署到
`metrics.hunhun.qd.je`；线上历史 V1 数据继续按裸版本 map 兼容读取。公开 90 天首次请求仍约
15 秒，重复请求缓存效果也需继续优化，这是后续评审应优先关注的实际性能问题。
