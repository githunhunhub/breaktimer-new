# 装机统计端点（EdgeOne Pages / Makers Edge Functions + KV HLL）

对应 SPEC-0018 与 ADR-0023。只接收应用发出的匿名装机事件，把 `installId` 转换为
HyperLogLog 草图并输出 M1～M8 近似聚合；不保存逐装机明细、明文 `installId`、IP、
用户名、硬件信息或任何使用内容。

## 组成

| 文件 | 作用 |
| --- | --- |
| `edge-functions/v1/collect.js` | `/v1/collect` 路由：仅允许 POST，校验、HLL 合并、KV 写入 |
| `edge-functions/api/report.js` | `/api/report` 路由：仅允许 GET，维护令牌鉴权、M1～M8 JSON/CSV 报表 |
| `edge-functions/_lib/*.js` | 不导出 handler 的共享模块：校验、HLL、键名、环境变量与写入/报表逻辑 |
| `test/*.test.mjs` | `node --test`，无额外依赖；覆盖校验、HLL、写入、报表与隐私 |
| `edgeone.json` | 直接上传模式支持的响应头配置（仅 `headers` 字段） |
| `.env.example` | 环境变量示例；真实值只在 EdgeOne 控制台配置 |

## 首次部署

1. 在 EdgeOne 控制台创建 Makers 项目，关联 Git 仓库，并把项目根目录设为
   `server/metrics`（或将该目录作为独立项目/直接上传目录）。`edge-functions/` 与
   `edgeone.json` 必须位于被部署目录的根层。直接上传时，`edgeone.json` 只使用官方文档
   支持的 `headers` 字段；项目构建参数在控制台配置，不写进该文件。
2. 开通 KV Storage 并创建 Namespace；在 `KV Storage → Bind Namespace` 绑定到该项目，
   **变量名填 `METRICS_KV`**。官方 KV 示例以全局变量访问绑定的 Namespace；代码同时兼容
   `context.env.METRICS_KV`、`context.METRICS_KV` 与全局 `METRICS_KV`，实际注入形式须在
   部署后用一个测试请求核验。
3. 设置项目环境变量：`DISABLED=0`、`MAINTENANCE_TOKEN=<随机强令牌>`。令牌只保存在
   平台环境变量或本地密钥管理器，不写入 Git。
4. 绑定稳定的自定义 HTTPS 域名。平台默认项目域名在中国大陆需要 3 小时预览链接，
   不能作为客户端上报地址；中国大陆/全球含大陆节点可能要求域名备案，部署前确认加速区域、
   WAF 与访问日志配置。
5. 部署后先用测试请求验证 `/v1/collect`，再在发布流水线设置
   `BREAKTIMER_METRICS_URL=https://<metrics-domain>/v1/collect`。未设置该构建变量时，
   客户端统计能力整体关闭，fork 与本地构建不会发到维护者端点。

## 启用客户端上报

```powershell
$env:BREAKTIMER_METRICS_URL = "https://<metrics-domain>/v1/collect"
```

应用使用 Rust `reqwest` 直接 POST，不经过 WebView `fetch`，不需要 CORS；只走 HTTPS、
不跟随重定向、不带 Cookie。KV 只由 Edge Functions 通过绑定访问，客户端不能直连 KV。

## 查看数据

报表需要维护令牌，返回匿名聚合，不返回逐装机列表。日期范围为客户端本地日
`YYYY-MM-DD`，最多 366 天。

```powershell
$token = "<MAINTENANCE_TOKEN>"
$headers = @{ Authorization = "Bearer $token" }

# 日报表：M1（日活）、M3（日各版本活跃）、M5（日新增），以及 M7/M8 历史总量
Invoke-RestMethod `
  -Uri "https://<metrics-domain>/api/report?from=2026-11-01&to=2026-11-30&granularity=day&format=json" `
  -Headers $headers

# 月报表：M2（月活）、M4（月各版本活跃）、M6（月新增），以及 M7/M8 历史总量
Invoke-WebRequest `
  -Uri "https://<metrics-domain>/api/report?from=2026-01-01&to=2026-12-31&granularity=month&format=csv" `
  -Headers $headers -OutFile metrics.csv
```

输出统一带 `approximate=true`、`method=hll`、`consistency=eventual_60s`，以及
`Cache-Control: no-store`。月活跃/月新增由当月每日 HLL 合并得到，不是日值求和；
M8 是首次上报版本近似值，升级后重放的 `install` 可能进入多个版本草图。

## KV 与隐私注意事项

- KV 固定 16 个分片，key 形如 `h_act_20261105_03`、`h_new_20261105_03`、
  `h_ver_20261105_03`、`h_total_03`、`h_install_ver_03`；每个有事件的自然日最多 48
  个 key，与装机数无关。value 只含 HLL 寄存器和版本 map。
- 写入路径为逐 key `get` → 合并 → `await put`，全部成功后返回 `204`；KV 写入失败返回
  `500` 让客户端静默重试。重复事件不会让 HLL 估计重复增长，但并发与 60 秒最终一致可能
  造成少量低估。
- `day` 仅接受服务端当天 ±1 天；`install.firstLaunchDay` 允许最近 730 天的离线补报，
  且不得晚于 `day`。历史草图当前不清理；KV 容量达到免费额度 80% 时另立需求评估归档。
- 业务代码不读取 `request.eo.clientIp` / `geo`，不记录请求体或原始 IP，不输出
  `installId`。平台自动访问日志字段与保留期、KV 中心存储区域必须在部署前于控制台核验，
  并把结论写入 SPEC-0018 的人工验收记录。
- 临时停用时把 `DISABLED` 改为 `1` 并重新部署，端点返回 `410`，客户端会静默失败。

## 测试

```powershell
cd server/metrics
npm test
```

部署前还要在 EdgeOne 运行环境中核验：KV 绑定变量名、相对模块导入、`_lib/` 共享模块不会被
平台暴露成可公开访问的有效路由，以及两个路由对工作方法之外请求返回 `405`。若平台会把
`_lib/` 下的文件映射成公共路由，应把共享模块移到平台确认不参与路由映射的目录。测试使用
内存 KV 模拟，不会替代平台上的联调。
