# 装机统计服务（EdgeOne Pages / Makers Edge Functions + KV HLL）

对应 SPEC-0018、SPEC-0022、ADR-0023 与 ADR-0029。只接收应用发出的匿名装机事件，把
`installId` 转换为 HyperLogLog 草图并输出 M1～M8 近似聚合；不保存逐装机明细、明文
`installId`、IP、用户名、硬件信息或任何使用内容。统计域名同时提供无登录的公开聚合看板，
维护者任意范围查询仍由维护令牌保护。

## 组成

| 文件 | 作用 |
| --- | --- |
| `edge-functions/v1/collect.js` | `/v1/collect` 路由：仅允许 POST，校验、HLL 合并、KV 写入 |
| `edge-functions/api/report.js` | `/api/report` 路由：仅允许 GET，维护令牌鉴权、M1～M8 JSON/CSV 报表 |
| `edge-functions/api/public-report.js` | `/api/public-report` 路由：仅允许 GET，固定 7/30/90 天范围的公开聚合报表 |
| `edge-functions/_lib/*.js` | 不导出 handler 的共享模块：校验、HLL、键名、环境变量与写入/报表逻辑 |
| `test/*.test.mjs` | `node --test`，无额外依赖；覆盖校验、HLL、写入、公开/私有报表、看板静态约束与隐私 |
| `public/dashboard/` | 公开看板 HTML、CSS、同源脚本、本地 SVG 与图形转换模块（SPEC-0022） |
| `public/robots.txt` | 静态输出目录中的抓取限制；不得放入任何源码 |
| `edgeone.json` | 按路由设置安全头与缓存策略；平台还支持 `buildCommand`、`outputDirectory` 等字段 |
| `.env.example` | 环境变量示例；真实值只在 EdgeOne 控制台配置 |

## 首次部署

1. 在 EdgeOne 控制台创建 Makers 项目，关联 Git 仓库，控制台字段按仓库结构填写：
   - 项目名称：`breaktimer-new-metrics`
   - 生产分支：`develop`。端点属于独立部署物，不占用 `master` 发版分支（铁律 8）；
     端点稳定后可改回 `master`，`server/metrics` 在两个分支上一致。
   - 框架预设：`Other`；加速区域：不含中国大陆（避免域名备案，区域结论写入 SPEC-0018
     人工验收记录）。
   - 根目录：`server/metrics`。`edge-functions/` 与 `edgeone.json` 必须位于被部署目录的
     根层，否则路由前缀会变成 `/server/metrics/v1/collect`。
   - 输出目录：`public`（包含 `dashboard/` 与 `robots.txt`）。填 `.` 会把整个目录
     （`test/`、`README.md`、`package.json`）当成静态资源上传；填 `edge-functions` 会让
     函数目录错位。`_lib/` 的安全性不依赖输出目录：平台把 `_` 前缀文件视为内部模块、不参与路由。
   - 构建命令 / 安装命令：留空；平台强制必填时填 `echo skip`（无构建步骤、无运行时依赖）。

   本项目由 Git 推送触发构建，构建参数以控制台字段为准；`edgeone.json` 同样支持
   `buildCommand`、`outputDirectory`、`redirects`、`rewrites`、`devCommand`（官方技能包
   记录），但控制台字段与该文件的优先级未核验，故不重复声明，避免改变已上线的行为。
2. 开通 KV Storage 并创建 Namespace；在 `KV Storage → Bind Namespace` 绑定到该项目，
   **变量名填 `METRICS_KV`**。绑定后它是一个**全局变量**，并不在 `context.env` 里
   （官方原文：`Do NOT use context.env.KV`）。`_lib/runtime.js` 先取全局 `METRICS_KV`，
   `context.METRICS_KV` / `context.env.METRICS_KV` 只作为本机测试与其它运行时的回退；
   线上已用测试心跳核验（`POST /v1/collect` 返回 `204`）。
3. 设置项目环境变量：`DISABLED=0`、`MAINTENANCE_TOKEN=<随机强令牌>`。令牌只保存在
   平台环境变量或本地密钥管理器，不写入 Git。
4. 绑定稳定的自定义 HTTPS 域名。平台默认项目域名在中国大陆需要 3 小时预览链接，
   不能作为客户端上报地址；中国大陆/全球含大陆节点可能要求域名备案，部署前确认加速区域、
   WAF 与访问日志配置。
5. 部署后先验证 `/dashboard`、`/dashboard/`、`/api/public-report`、`/v1/collect` 与受保护的
   `/api/report`，再在发布流水线设置
   `BREAKTIMER_METRICS_URL=https://<metrics-domain>/v1/collect`。未设置该构建变量时，
   客户端统计能力整体关闭，fork 与本地构建不会发到维护者端点。

## 启用客户端上报

```powershell
$env:BREAKTIMER_METRICS_URL = "https://<metrics-domain>/v1/collect"
```

应用使用 Rust `reqwest` 直接 POST，不经过 WebView `fetch`，不需要 CORS；只走 HTTPS、
不跟随重定向、不带 Cookie。KV 只由 Edge Functions 通过绑定访问，客户端不能直连 KV。

## 查看数据

公开看板位于 `https://<metrics-domain>/dashboard/`，不需要登录、Cookie 或
`Authorization`。页面只请求同源 `GET /api/public-report`，支持最近 7/30/90 天与日/月
粒度；接口拒绝任意日期、CSV、重复参数和未知参数。成功响应带 60 秒公开缓存，错误响应为
`no-store`；看板与接口均不新增 CORS。公开响应只含匿名聚合、版本分布和统计元数据，
不返回逐装机列表。

维护者报表仍需要令牌，返回匿名聚合，不返回逐装机列表。日期范围为客户端本地日
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

测试覆盖三条函数路由的方法限制、私有报表鉴权与格式回归、公开报表的固定参数、白名单
字段、缓存与隐私边界，以及看板静态资源、CSP 和同源请求约束。测试用内存 KV 模拟
（`context.env` 形式），全局绑定路径由 `test/runtime.test.mjs` 单独覆盖。

部署前还要在 EdgeOne 运行环境中核验：KV 绑定变量名为 `METRICS_KV`、相对模块导入可用，
`/dashboard`、`/dashboard/` 与本地资源可访问，`/api/public-report` 在无 Cookie/Authorization 时返回
`200`，`/api/report` 的鉴权和 `no-store` 边界未改变，以及三条函数路由对不支持的方法返回
`405`。`_lib/` 不需要额外防护：官方约定 `_` 前缀文件是内部模块、不参与路由，线上
`/_lib/collect.js` 已核验为 `404`。这些本地检查都不替代平台上的联调和缓存头核验。

## 平台差异（已在线上核验）

EdgeOne Edge Functions 的 `context.request` 是标准 `Request`，但 `request.body` 的
`ReadableStream` **恒为空**：请求体只通过 `request.text()` / `request.json()` 暴露。
曾按 Web Stream 读取，线上表现是所有合法上报都返回 `400 invalid JSON`
（`SyntaxError: Unexpected end of JSON input`）。`_lib/collect.js` 因此优先调用 `text()`，
流、字符串、Buffer、字节数组与已解析对象仅作回退；改动这段读取逻辑前请先读
`test/collect.test.mjs` 里「prefers text() over an empty body stream」用例。

同时核验通过：`DISABLED` 与 `MAINTENANCE_TOKEN` 通过 `context.env` 注入；`public/` 作为
输出目录时 `/robots.txt` 可访问，`/_lib/*.js` 与 `/edge-functions/*` 均返回 `404`。
EdgeOne 的 `URLSearchParams` 支持 `keys()` / `get()`，但不支持 `Array.from()` 或展开运算符
读取条目；曾因此让 `/api/public-report` 在任何业务读取前抛错并返回 `400`。公开报表解析
必须使用 `keys()` / `get()`，改动参数校验时保留 `test/public-report.test.mjs` 中禁用条目
迭代的回归用例。

路由级 `Cache-Control` 会覆盖 Edge Function 返回的同名响应头。`/api/public-report` 因此
不得在 `edgeone.json` 中配置 `Cache-Control`，由函数按结果分别返回成功 60 秒公开缓存与
错误 `no-store`。KV 为空不是错误：公开接口返回 `200` 和全零报表，看板展示空状态。
公开报表按 30 天批读取 KV：7 天批能让 90 天请求串行等待 13 轮，线上会触发 EdgeOne
`545`；公开接口固定最多 90 天，使用 30 天批把它压缩为 3 轮。私有 `/api/report` 最大
366 天，继续保持 7 天批以限制单次内存与并发规模。
公开看板、公开接口及其路由级安全头、缓存策略尚待 SPEC-0022 部署后线上核验。
KV 写入后有一小段不可见期：线上出现过 `h_ver_*` 写入成功、报表首次读取却为空的
情况，约一分钟后复测恢复，与 `consistency=eventual_60s` 一致；核对报表前留出同步窗口，
读不到不要当成写入失败。

## 与官方 Makers 技能包的对照（2026-11-13）

按 [edgeone-makers-tools](https://github.com/TencentEdgeOne/edgeone-makers-tools) 的
`makers-edge-functions` / `makers-storage` / `makers-frameworks` / `makers-deploy`
逐条复核本目录的实现：

| 结论 | 依据与本仓库现状 |
| --- | --- |
| KV 是控制台绑定的全局变量，不在 `context.env` | `makers-storage/references/kv.md`；`getKv` 已改为全局优先，环境变量只做回退 |
| `_` 前缀文件是内部模块，不参与路由 | `makers-recipes/SKILL.md`；与线上 `404` 结果一致，不需要把 `_lib/` 藏到别处 |
| Edge Functions 是 V8：无 npm / Node 内置模块，`Response.json()` 不可用 | `makers-edge-functions/SKILL.md`；本目录只用标准 Web API 与普通对象 headers |
| 请求体 1 MB、单次 CPU 200 ms、代码包 5 MB | 同上；上报体上限 2 KB，单次写入 2～5 个 key，远低于限制 |
| KV key 仅字母数字下划线、value ≤ 25 MB、`list` 单页 256 | `kv.md`；本目录不用 `list`，key 形如 `h_act_20261105_03` |
| 批量读用 `Promise.all`，不要逐条 `await` | `kv.md` 最佳实践；私有报表按 7 天批、公开报表按 30 天批并发读取 |
| `edgeone.json` 可声明 `buildCommand` / `outputDirectory` / `redirects` / `rewrites` | `makers-frameworks` / `makers-deploy`；见上文构建参数的取舍 |
| CLI 流程（≥ 1.7.0、`PAGES_SOURCE=skills`、`.edgeone/project.json`） | 本项目由 Git 推送触发构建，不经过 CLI，相关要求不适用 |
