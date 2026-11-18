# SPEC-0025：公开客户端统计报表读取性能优化

- 状态：in-progress
- 日期：2026-11-16
- 最近更新：2026-11-18
- 关联：SPEC-0018 · SPEC-0022 · ADR-0023 · ADR-0029 · ADR-0031 · ADR-0032 · ADR-0033

## 背景 / 问题

公开看板使用固定 7/30/90 天范围。V1 在 namespace 非空后按理论分片盲读，线上
`range=7d` 首次字节约 13 秒，`range=30d` 约 51 秒；稀疏数据下几乎所有 `get` 都返回空值。

现有优化已经采用“空探测 + 按实际前缀列举 + 只读取存在的 key + Cache API”。客户端统计
V2 不再有月粒度和两个全局维度，读取前缀从 3 个日维度 + 2 个全局维度收敛为
`h_act_`、`h_ver_`、`h_newch_` 三个日维度。

## Key 数量对比

固定 16 分片下，理论 key 数如下：

| 方案 | 每日 key | 7 天 | 30 天 | 90 天 |
| --- | ---: | ---: | ---: | ---: |
| V1 当前理论值 | 48 + 32 个全局 key | 368 | 1,472 | 4,352 |
| V2 目标值 | 48 | 336 | 1,440 | 4,320 |

V2 每类日维度最多 16 个 key：

```text
h_act_YYYYMMDD_shard
h_ver_YYYYMMDD_shard
h_newch_YYYYMMDD_shard
```

节省的 32 个 key 来自删除 `h_total_*` 和 `h_install_ver_*`。V2 不保存累计指标，因此 key
数量只随日期和实际命中的分片增长。实际 KV 用量通常远低于理论上限。

## 需求（做什么）

1. 公开接口先执行一次 `kv.list({ prefix: "h_act_", limit: 1 })` 探测 V2 数据是否存在。
   `complete=true` 且缺少 `keys` 视为空 namespace。
2. namespace 非空时，只列举范围内每天的三个实际前缀：
   `h_act_YYYYMMDD_`、`h_ver_YYYYMMDD_`、`h_newch_YYYYMMDD_`。
3. 每条列举必须跟随 `cursor` 直到 `complete=true`，条目 key 名从官方 `key` 字段读取。
4. 只对列举结果中属于目标范围的合法 key 执行 `kv.get`，不得读取理论存在但未列出的 key。
5. 列举和读取都按最多 8 个并发执行。
6. 公开报表只接受日粒度，不列举任何全局 key、旧 `h_new_`、`h_total_` 或
   `h_install_ver_`。
7. 成功响应使用 `public-report-v2` Cache API，缓存上限 60 秒；缓存命中不访问 KV。
8. 只缓存成功 200；参数错误、方法错误、KV 绑定缺失、列举失败或读取失败都返回 `no-store`。
9. 私有 `/api/report` 保持固定 16 分片盲读，不调用 `kv.list`。其逻辑读取量为：

   ```text
   rangeDays × 3 dimensions × 16 shards
   ```

   7/30/90 天分别为 336/1,440/4,320 次 get，且不再读取全局 key。

10. 日志记录 `cache`、`emptyNamespace`、`listPrefixCount`、`listPageCount`、
    `listedKeyCount`、`readKeyCount`、`rowCount`、`activeAverage`、`activePeak` 和
    `newClients`。

## 验收标准

- [x] **P1** 空 namespace 在 7/30/90 天下都只执行一次 `h_act_` 探测，不执行 `get`。
- [x] **P2** 非空 namespace 只列举每天三个 V2 前缀，不出现全局或旧 `h_new_` 前缀。
- [x] **P3** 公开报表只读取 `kv.list` 返回的实际 V2 key；稀疏 90 天测试不按 4320 个理论
      分片盲读。
- [x] **P4** `kv.list` 分页、空页缺省 `keys`、`{ key }` 条目和 `complete=false + cursor`
      均按 EdgeOne 契约处理。
- [x] **P5** 同一 URL 在 60 秒内命中原有 Cache API 条目，KV 调用计数保持为零。
- [x] **P6** 60 秒后缓存失效并重新列举读取；KV 失败不写入缓存。
- [x] **P7** 公开 KV 操作并发上限为 8；私有报表不调用 `kv.list`。
- [x] **P8** 日志计数来自真实路径，不输出具体 key、value、`installId` 或请求元数据。
- [x] **P9** `server/metrics/npm test` 与 `app/pnpm verify` 全部通过。
- [ ] **P10** 部署后复测 7/30/90 天 TTFB 与缓存命中；本 spec 不自动授权部署。

## 非目标 / 边界

- 不修改客户端协议、V2 key 形态、HLL 参数或写入路径。
- 不引入数据库、定时任务、预计算快照或新的托管存储。
- 不优化私有报表为列举路径；维护者低频任意范围仍使用固定分片盲读。
- 不改变公开 7/30/90 天范围、60 秒缓存或安全边界。
- 不删除历史 V1 key；旧 key 不参与 V2 报表。

## 设计要点

- 空探测使用 `h_act_` 而不是宽泛的 `h_`，避免只有旧全局 key 时进入昂贵的列举路径。
- 范围内每天三个 list 前缀，一个普通 key 可以被各自前缀唯一归属；合法 key 去重后再读取。
- 缓存键规范化为 `range=<7d|30d|90d>&granularity=day`，不受查询参数顺序影响。
- 缓存条目内部保存 `{ savedAt, body }`，宿主未自动淘汰时仍按 60 秒自行判断过期。
- 公开列表和 get 分成两个有界批次，避免 90 天请求一次创建数百个并发操作。

## 实现计划

- [x] 文档：KEY 数量、前缀与 V2 缓存契约同步到 SPEC/ADR/README。
- [x] 测试：更新公开列表前缀、空探测、分页、缓存与日志测试并确认 RED。
- [x] 服务端：V2 key helper、公开读取与私有盲读。
- [x] 验证：统计服务测试和 `app/pnpm verify`。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-18 | 按客户端统计 V2 收敛为三个日前缀，删除全局 key，缓存名改为 `public-report-v2` |
| 2026-11-16 | 引入真实日前缀列举、分页、8 并发与 60 秒 Cache API |
| 2026-11-16 | 创建公开报表稀疏读取性能问题记录 |
