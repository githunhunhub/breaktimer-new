# ADR-0023：装机统计改用 EdgeOne KV + HLL 近似聚合

- 状态：已接受
- 日期：2026-11-05
- 决策者：项目作者
- 关联：SPEC-0018 · ADR-0019 · ADR-0020 · ADR-0022
- 部分取代：ADR-0019 中的「Cloudflare Worker + D1」服务端选型与逐装机明细口径；
  ADR-0019 的匿名上报、字段白名单、默认开启与可关闭约束仍然有效，ADR-0020 全部有效

## 背景

Cloudflare Worker 路线部署不通，项目改用腾讯 EdgeOne Pages / Makers。官方文档说明 KV
目前仅能由 Edge Functions 访问，不支持 SQL、事务、CAS 或原子自增，边缘缓存最长 60 秒
最终一致。客户端不能绕过 Edge Function 直接读写 KV。

原先模拟 D1 的设计为每条装机/活跃事实保存一个 KV key：1000 份装机至少产生约 3000 个 key，
而且报表需要遍历明细和读-改-写计数，既不符合「只关心统计值」的目标，也会因并发覆盖丢更新。
项目作者明确本轮不追求精确统计，只要求下列八项趋势/总数：日/月活跃、日/月各版本活跃、
日/月新增装机、总装机与各版本装机。

## 决策

1. 统计端点部署在 EdgeOne Pages / Makers Edge Functions，客户端只访问自定义 HTTPS 域名下的
   `POST /v1/collect`；KV Namespace 通过变量名 `METRICS_KV` 绑定到该项目。保持客户端字段
   白名单、构建期 `BREAKTIMER_METRICS_URL` 与关闭开关不变。
2. 不再保存逐装机事实或逐装机明细。服务端把 `installId` 通过 SHA-256 映射为寄存器桶位和
   固定分片，写入 HyperLogLog（HLL）草图；KV value 只含寄存器/版本分组，不含明文 `installId`。
   相同 ID 重复上报不会增加基数估计，多个日草图可合并得到自然月去重估计。
3. 固定 `S=16` 个分片，每日最多 48 个日草图 key，另有 32 个历史全局 key；key 数量与装机量
   无关。不使用随机分片、事件事实 key、`SHARD_LIMIT`、`upper_bound=true` 或 SQL/D1。版本号
   放在受校验的 value JSON map 中，不放入 KV key。
4. 报表范围固定为 M1～M8：日/月活跃装机、日/月各版本活跃装机、日/月新增装机、累计装机、
   各版本装机。所有输出标注 `approximate=true`、`method=hll` 与 `consistency=eventual_60s`。
   月活跃是当月每日 HLL 的并集，不是日活相加；安装版/便携版占比、装机留存、滚动 WAU/MAU、
   语言/OS 分布、逐安装明细均不在本轮范围。
5. `day` 仅接受服务端当天前后一天；`install` 的 `firstLaunchDay` 允许离线补报的历史日期
   （不超过 730 天），新增装机按 `firstLaunchDay` 归日，月新增按自然月合并日 HLL。
6. 各版本装机数按首次收到的 `install` 事件版本估计。无逐装机状态时，升级后重放的
   `install` 可能把同一 ID 带入另一个版本 HLL；该指标是「首次上报版本」的近似值，
   不是严格首装版本，必须在 SPEC 与报表说明中披露。
7. 写入路径串行读取、合并并 `await put` 每个草图后再返回 `204`，失败返回 `5xx` 让客户端
   重试；不使用 `waitUntil` 提交关键写入。报表接口用 `MAINTENANCE_TOKEN` 鉴权，只输出匿名
   聚合，输出 `Cache-Control: no-store`。
8. 业务代码不读取 `request.eo.clientIp` / `geo`，不记录请求体或 IP，不启用会持久化请求体的
   自定义日志。平台自动访问日志字段、保留期、KV 区域、自定义域名/备案/加速区域仍须在部署前
   于控制台核验并如实披露；未核验前不得声称合规验收完成。
9. 使用自定义域名而非平台默认项目域名：中国大陆访问默认项目域名需要 3 小时预览链接，
   不适合作为稳定上报地址。以 `https://<metrics-domain>/v1/collect` 配置
   `BREAKTIMER_METRICS_URL`，不把 KV Namespace 或管理 API 暴露给客户端。

## 理由

- 用户只关心统计趋势，不关心明细；HLL 用固定大小的不可逆草图替代 N 个装机事实 key，
  1000 或 10000 份装机都不会让 key 数线性增长。
- HLL 的幂等合并适合 KV 的覆盖写与重试：重复事件只会写入同一个寄存器值；日草图可按月合并，
  不需要事务型去重集合。代价是约 1～3% 的基数误差、并发 `get`/`put` 可能丢失一次更新、
  以及 KV 最终一致带来的约 60 秒延迟，这些正是「不要精确统计」允许接受的范围。
- 固定分片缩小单次请求写入的 KV 数量，且按 `installId` 哈希稳定分配，使同一 ID 总落在同一
  分片；跨分片只需把相同维度的草图逐寄存器取最大值即可合并。
- 继续使用既有 Rust `telemetry` 协议可复用设置页、i18n、发布流水线与人工验收，不扩大客户端
  改动面；服务端只需替换 `server/metrics/` 和 CI 变量值。
- EdgeOne KV 免费 1 GB、单 value 25 MB，足以容纳按日/版本增长的草图；目前不做保留期清理。
  未来达到容量 80% 时再另立需求评估归档，不在本轮引入定时任务。

## 影响

- `docs/specs/0018-installation-metrics.md` 的指标、验收、设计要点与实现计划按 M1～M8 重写；
  `docs/overview.md`、`docs/glossary.md`、`docs/architecture.md`、`docs/roadmap.md`、
  `docs/specs/README.md`、`AGENTS.md`、`DEVELOPMENT.md`、`README.md` 与
  `server/metrics/README.md` 同步去掉 Worker + D1 / 明细 / 留存口径。
- `server/metrics/` 删除 Worker、D1 schema、SQL 报表与 `wrangler.toml`，改为 Edge Functions
  路由、校验、HLL、写入、报表与 Node 测试；旧 Worker 代码不再部署。
- 当前日数据在 60 秒缓存窗口内可能变化，历史日是稳定快照；报表只供维护者看趋势与比例，
  不是审计级计数，也不提供「现存用户数」。
- 若未来需要严格首装版本、留存或精确去重，必须引入客户端持久化首装版本、外部事务存储或
  另一套协议，并另立 SPEC / ADR，不把明细硬塞回本方案。
- 平台域名、备案、区域、WAF 与访问日志仍待部署核验；本 ADR 只决定代码与数据模型，
  不代表部署或合规人工验收通过。
