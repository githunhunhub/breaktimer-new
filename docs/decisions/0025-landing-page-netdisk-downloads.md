# ADR-0025：宣传页下载入口改用 Release 网盘元数据

- 状态：已接受
- 日期：2026-11-07
- 决策者：项目作者
- 关联：SPEC-0016 · SPEC-0017 · ADR-0018 · ADR-0024（部分取代其第 6 条）

## 背景

ADR-0024 让宣传页在部署时解析最新 Release，把 `*-setup.exe` / `*-portable.zip`
资产直链写进页面。应用内的更新检查（SPEC-0017 / ADR-0018）已经改为只引导百度网盘与
夸克网盘，GitHub 仅用于版本检查；如果宣传页仍把 GitHub 资产作为主下载入口，同一项目
会出现两套互相矛盾的下载引导，且国内用户访问 GitHub 资产经常失败。

## 决策

1. 宣传页下载区改为两个网盘入口：百度网盘、夸克网盘，顺序与应用内更新卡片一致。
2. 链接来源与 SPEC-0017 相同：最新 Release 正文的隐藏标记
   `<!-- breaktimer-downloads {"baidu":"...","quark":"...","baiduCode":"..."} -->`。
   标记不存在、字段为空或值为 `null` 时视为未配置。
3. `site/scripts/resolve-downloads.mjs` 解析该标记并校验：必须是 `https`，主机必须是
   `pan.baidu.com` / `pan.quark.cn`；非法链接直接让部署失败。
4. 未配置时隐藏对应网盘卡片，并显示「暂未配置」提示，同时保留 GitHub Releases 作为
   版本历史与 SHA256SUMS 的兜底入口；页面不再默认把 GitHub 资产当作下载按钮。
5. 页面仍只描述已发布能力，不猜测网盘链接，也不硬编码版本号。

## 理由

- 与 SPEC-0017 的下载引导保持一致，用户从应用和从宣传页看到的是同一个下载渠道。
- 复用 Release 正文元数据，链接失效时只需编辑 Release 正文或补充
  `.github/release-downloads.json` 后重新发布，无需改动站点代码。
- 部署期校验主机与协议，避免把错误或钓鱼链接发布出去。
- 未配置时显式降级而不是发布死链；当前 `v0.1.1` 尚未填写网盘链接，站点会显示提示。

## 影响

- 取代 ADR-0024 第 6 条（部署时写入 GitHub 资产直链），其余决策不变。
- `site/scripts/resolve-downloads.mjs` 与其测试改为解析 Release 正文元数据；
  `site/index.html`、`site/en/index.html` 的下载区改为百度 / 夸克两张卡片加兜底提示。
- 发布前必须维护 `.github/release-downloads.json` 中的网盘链接，否则站点与应用都会
  显示「未配置」。
- 网盘链接变化不需要重新发布站点：编辑 Release 正文后重新部署即可。
