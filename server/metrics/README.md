# 装机统计端点（Cloudflare Worker + D1）

对应 SPEC-0018 与 ADR-0019。只接收应用发出的匿名装机事件，输出聚合报表；
不采集 IP、用户名、硬件信息或任何使用内容。

## 组成

| 文件 | 作用 |
| --- | --- |
| `src/index.js` | `POST /v1/collect` 入口、写入幂等、每日保留期清理 |
| `src/validate.js` | 字段白名单与格式校验（未知字段直接拒绝） |
| `schema.sql` | `installs` 与 `daily_active` 两张表 |
| `queries.sql` | 累计/新增/DAU/WAU/MAU/留存/版本/形态报表 |
| `wrangler.toml` | Worker 名称、D1 绑定、停用开关、定时清理 |
| `test/validate.test.mjs` | 校验逻辑测试（`node --test`，无额外依赖） |

## 首次部署

需要 Node.js 与 Cloudflare 账号（免费套餐即可）。

```powershell
cd server/metrics
npx wrangler login
npx wrangler d1 create breaktimer_metrics
```

把输出的 `database_id` 填进 `wrangler.toml`，然后：

```powershell
npx wrangler d1 execute breaktimer_metrics --remote --file schema.sql
npx wrangler deploy
```

部署成功后会得到一个形如
`https://breaktimer-metrics.<your-subdomain>.workers.dev` 的地址。

## 启用客户端上报

在构建发布版时通过环境变量注入端点（不写进代码，fork 默认不上报）：

```powershell
$env:BREAKTIMER_METRICS_URL = "https://breaktimer-metrics.<your-subdomain>.workers.dev/v1/collect"
cd app
pnpm tauri build
```

未设置该变量时，`telemetry` 模块完全不发请求。CI 发布流水线需要把它配置为
Repository variable / Secret。

## 查看数据

```powershell
# 全部报表
npx wrangler d1 execute breaktimer_metrics --remote --file queries.sql

# 单条查询
npx wrangler d1 execute breaktimer_metrics --remote --command "SELECT COUNT(*) FROM installs;"
```

口径说明见 `docs/specs/0018-installation-metrics.md`：装机不等于用户，
一人多机计多次；卸载无法回传。

## 运行与隐私注意事项

- 不要在 Worker 中读取、记录或持久化客户端 IP；不要开启 Logpush。
- 不要记录请求体；排障时只能用聚合 SQL，不要导出逐个 `installId` 的明细。
- `daily_active` 明细保留 180 天，由 Cron 触发删除；`installs` 仅保留最近活动日。
- 需要临时停用时，把 `wrangler.toml` 的 `DISABLED` 改为 `"1"` 并重新部署，
  客户端会收到 `410` 并静默失败。
- 免费套餐额度足够本项目量级（数千请求/月）；如额度或定时任务受限，可先删除
  `[triggers]` 段，改为手工清理。

## 测试

```powershell
node --test server/metrics/test/validate.test.mjs
```
