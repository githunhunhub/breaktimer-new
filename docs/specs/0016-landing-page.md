# SPEC-0016：宣传页（Landing Page）

- 状态：in-progress
- 日期：2026-11-02
- 关联：SPEC-0011 · SPEC-0012 · SPEC-0020 · ADR-0011 · ADR-0024 · ADR-0025 · 视觉参考 <https://breaktimer.app/>

## 背景 / 问题

BreakTimer-new 目前对外只有 GitHub 仓库和 `README.md`：拿到链接的人要先读一整页 Markdown
才知道它是什么；GitHub Releases 页面也没有引导未签名安装包的 SmartScreen 处置方式。

2026-11-02 用户提出做一个单页宣传页，版式参考旧版项目官网 <https://breaktimer.app/>，
计划托管到 GitHub Pages 或 Cloudflare Pages。仓库已公开（`githunhunhub/breaktimer-new`），
但还没有任何站点，这个页面会成为项目的第一个对外门面。

## 需求（做什么）

1. 单页静态宣传页，信息层级对齐参考站：顶栏 → Hero → 特性区 → 下载区 → 页脚。
2. 内容只描述当前已实现的能力（SPEC-0002 ~ SPEC-0014），不承诺 macOS/Linux、自动更新、
   企业部署或任何尚未实现的特性。
3. 下载区引导到发布侧网盘入口（百度网盘、夸克网盘），与应用内更新检查一致；不直接链接
   GitHub Release 资产。网盘内同时提供安装版（`*-setup.exe`）与便携版（`*-portable.zip`），
   页面说明两者差异；网盘未配置时显示「暂未配置」提示并以 GitHub Releases 兜底。
   未签名安装包在 SmartScreen 下的处置（「更多信息」→「仍要运行」）措辞与 `README.md`
   保持一致。
4. 说明与旧版 BreakTimer 的关系：不单独设「与旧版」区块，关系由页脚署名说明
   （源自 `tom-james-watson/breaktimer-app`，重写实现、不是旧版分支）。
5. 纯静态实现：资源全部本地，不引远程字体与 CDN，无第三方统计、无 Cookie、无表单。
6. 站点目录独立于 `app/`（应用代码）与 `docs/`（Markdown 事实源），发布产物只有站点目录。
7. 托管在 GitHub Pages 或 Cloudflare Pages，二者取其一或都配，见「开放问题」Q2。
8. 语言按 Q4 定；首版至少提供简体中文。

## 验收标准（可测）

- [x] **L1** 本地静态服务器下页面可用，1440px 与 375px 两个宽度下无横向滚动、无元素重叠。
- [ ] **L2** 下载区每个链接都可点开并返回 200：网盘入口指向发布元数据（`baidu` / `quark`）
      给出的 HTTPS 链接，未配置时页面显示提示并提供 GitHub Releases 兜底。
      网盘链接补齐后复验（当前 `v0.1.1` 未配置）。
- [x] **L3** 页面文案逐条对照 `README.md`「主要功能」，不出现 README 与 spec 之外的能力描述。
- [x] **L4** 断网后刷新（外链除外）样式与图片完整，证明无远程字体 / CDN 依赖。
- [x] **L5** 按子路径（模拟 `/breaktimer-new/`）部署后所有资源返回 200。
- [x] **L6** 桌面 Lighthouse 的 Performance / Accessibility / Best Practices / SEO 均 ≥ 90，
      结果随验收记录提交。
- [ ] **L7** 上线后站点地址、HTTPS 证书与 404 行为均符合预期。
- [x] **L8** 发布 workflow 只发布站点目录，不构建、不改写 `app/` 产物，不触碰发布流水线（SPEC-0015）。
- [x] **L9** `app/` 全部门禁保持通过（`pnpm format:check` / `lint` / `typecheck` / `test` / `build`
      与 cargo 的 `fmt --check` / `check` / `test`）。

## 非目标 / 边界

- 不做文档站、博客或更新日志页；变更日志继续由 GitHub Release 与 `git-cliff` 承担。
- 不自行托管安装包，也不自建镜像；安装包仍由 GitHub Releases 产出与存档，网盘只作为
  对国内用户更友好的分享入口，内容与 Release 资产一致。
- 不做在线试用、Web 版或内嵌演示播放器。
- 不复制参考站的文案、图片与字体文件：旧站内容为 GPLv3；本站只使用自有文案，
  许可声明与署名规则见 SPEC-0020。
- 不修改 `app/` 运行代码，不改变发布流水线语义，只新增独立的站点发布配置。

## 设计要点

参考站实测结构（2026-11-02 抓取）：单页，顶栏 logo → Hero（一句话 + 两个按钮 + 产品截图）
→ 四张等宽特性卡 → 按平台列包的下载区 → 页脚（资源链接 + 许可证 + 免责声明）。对应到本项目：

| 区块     | 内容                                                      | 素材                  |
| -------- | --------------------------------------------------------- | --------------------- |
| 顶栏     | 名称 + 锚点导航（功能 / 下载）                            | `app/public/icon.png` |
| Hero     | 一句话价值 + 「下载」+「GitHub」两个按钮                  | 图标 + 纯排版视觉（Q5） |
| 特性     | 四张卡：休息调度 / 全屏阻断与通知 / 托盘与自启 / 中英双语 | 线性图标（Q5）        |
| 下载     | 百度 / 夸克网盘入口 + 安装版与便携版说明 + SmartScreen     | 无                    |
| 页脚     | 仓库 / Releases / 使用说明 / 许可证 + 源自 BreakTimer 的署名 | 无                   |

## 实现计划

- [x] 回答「开放问题」Q1 ~ Q6，答案回填本 spec，状态改为 `in-progress`。
- [x] 按 Q1 建站点目录，写出单页 HTML / CSS 与本地资源。
- [x] 按 L1 ~ L5 完成本地验收。
- [ ] 按 Q2 / Q3 配置托管与发布，跑通一次真实部署。
- [ ] 按 L7 完成上线验收（站点地址、HTTPS、404）。
- [ ] 补齐网盘链接（`.github/release-downloads.json`）后复验 L2。
- [x] 同步 `docs/roadmap.md`、`docs/architecture.md` 与各索引。
- [ ] 部署成功后更新 `README.md`（补站点地址）。

## 开放问题

| #   | 问题             | 备选                                                                         | 影响                                          |
| --- | ---------------- | ---------------------------------------------------------------------------- | --------------------------------------------- |
| Q1  | 站点目录放哪     | 仓库根 `site/`（推荐）/ `docs/site/` / 独立仓库                              | 决定「涉及文件」与 workflow 路径              |
| Q2  | 托管平台         | GitHub Pages / Cloudflare Pages / 两者都配                                   | 决定新增 `pages.yml` 还是 Cloudflare 项目配置 |
| Q3  | 是否绑自定义域名 | 不绑（`githunhunhub.github.io/breaktimer-new/`）/ 已有域名                   | 子路径还是根路径、DNS 与 HTTPS                |
| Q4  | 语言             | 中文单语 / 中英双语（应用已是双语）                                          | 页面结构与文案量                              |
| Q5  | 截图与图标       | `app/public/icon.png` + 新截 `pnpm tauri:dev` 界面 / 纯排版无图              | 阻塞 Hero 与特性区                            |
| Q6  | 许可与署名       | 补 `LICENSE`（类型待定）/ 页脚仅署名「源自 tom-james-watson/breaktimer-app」 | 公开站点必须能回答「能不能用、能不能改」      |

## 开放问题结论（2026-11-07）

| #   | 结论                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | 站点放在仓库根 `site/`，与应用代码 `app/`、文档源 `docs/` 分开。                                                                                 |
| Q2  | 首版使用 GitHub Pages，新增 `.github/workflows/pages.yml`，只发布 `site/`；Cloudflare Pages 暂不配置。                                           |
| Q3  | 暂不绑定自定义域名，站点基址为 `https://githunhunhub.github.io/breaktimer-new/`；资源全部使用相对路径，兼容子路径部署。                          |
| Q4  | 中英双语静态页：`site/index.html`（简体中文，默认）与 `site/en/index.html`；语言切换使用普通链接，不依赖 JS。                                    |
| Q5  | 使用 `app/public/icon.png` 的副本与纯排版视觉，不新增应用截图；图标变化时同步 `site/assets/icon.png`。                                          |
| Q6  | 该结论已由 SPEC-0020 取代：仓库整体采用 GPL-3.0-or-later，根目录提供 `LICENSE` 与 `NOTICE`，页脚改为许可声明 + 指向 `master` 分支 `LICENSE` 的链接。 |

补充约定：

- 页面保持纯静态 HTML / CSS，不引入构建器、远程字体、CDN、第三方统计、Cookie 或表单。
- 下载入口在本地预览时保留 `pan.baidu.com` / `pan.quark.cn` 占位链接与「发布后公布」
  提取码；部署时由 `site/scripts/resolve-downloads.mjs` 读取最新 Release 正文的
  `breaktimer-downloads` 标记，只写入网盘链接与提取码。页面不展示版本号，版本以
  GitHub Releases 为唯一事实源，下载区只保留「版本历史与 SHA256SUMS」链接。
  未配置的网盘卡片在部署产物中被隐藏，并显示 GitHub Releases 兜底提示。
- GitHub Pages 的 Source 需在仓库设置中选为「GitHub Actions」；workflow 只从 `master` 与手动
  触发部署，不构建或改写 `app/`，也不修改 `release.yml`。

## 验收记录

最近一次本地验收：2026-11-07（仓库 `<repo-root>`）。

实现位置：

| 关注点           | 文件                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| 中文主页 / 英文主页 / 404 | `site/index.html`、`site/en/index.html`、`site/404.html`            |
| 样式与图标       | `site/assets/styles.css`、`site/assets/icon.png`、`site/assets/icon-64.png` |
| 站点元信息       | `site/robots.txt`、`site/sitemap.xml`                                      |
| 发布 workflow    | `.github/workflows/pages.yml`                                              |
| 静态检查         | `site/scripts/check-static.mjs`                                            |
| 网盘链接解析     | `site/scripts/resolve-downloads.mjs`、`site/scripts/resolve-downloads.test.mjs` |

校验命令：

```shell
node site/scripts/check-static.mjs site
node --test site/scripts/resolve-downloads.test.mjs
```

结果：

- **L1**：headless Edge 在 1440×1100 与 375×1400 下检查中英文页面，`scrollWidth` 等于
  `clientWidth`，无横向溢出元素，无元素重叠。
- **L2**：网盘入口的链接来自 Release 元数据并在部署期校验（`https` + 固定主机），
  本地以构造的 Release 元数据验证了写入、提取码与卡片显隐；当前最新 Release `v0.1.1`
  未配置网盘，页面显示「暂未配置」提示并保留 `releases/latest` / `releases` 兜底。
- **L1 复验（2026-11-07）**：用 headless Edge 在 1440×1000 与 375×900 下检查中英文页面
  （网盘已配置与未配置两种状态），`scrollWidth` 等于 `clientWidth`，无溢出元素；
  兜底状态下隐藏的下载卡片不残留空白间距。
- **L3**：文案逐条对照 `README.md`「主要功能」，只描述已实现能力；明确写出仅支持
  Windows 10 / 11（x64）、无代码签名与 SmartScreen 处置。
- **L4**：`check-static` 证明页面无 `<script>`、无远程 `img` / `link` 资源，
  CSS 无远程 `url()` 与 `@import`；样式与图标全部来自 `site/assets/`。
- **L5**：本地静态服务器按 `/breaktimer-new/` 子路径提供站点，首页、英文页、样式、
  图标、`robots.txt`、`sitemap.xml` 均返回 200，未知路径返回 404。
- **L6**：桌面 Lighthouse（本地 gzip 静态服务）Performance 96 / Accessibility 100 /
  Best Practices 100 / SEO 100。首轮图标未缩放（约 175KB）时 Performance 为 87，
  缩放到 256×256 并启用 gzip 后达标。
- **L8**：`pages.yml` 只把 `site/` 复制为 `_site` 后上传，不运行 pnpm / Cargo，
  不修改 `release.yml`。
- **L9**：`app/` 执行 `pnpm verify` 全部通过（前端 87 个测试、Rust 128 个测试通过，
  需联网的更新检查测试按设计 ignored）。
- **L7**：待真实部署后回填（站点地址、HTTPS 证书、404 行为）。
- **下载入口**：`resolve-downloads.mjs` 从最新 Release 正文的
  `<!-- breaktimer-downloads {...} -->` 标记读取网盘链接，校验 https 与
  `pan.baidu.com` / `pan.quark.cn` 主机后写入两张下载卡；缺失时隐藏对应卡片并显示
  「暂未配置」提示（当前 `v0.1.1` 未配置，页面走兜底状态）。
- **附加**：`file://` 直接打开 `site/index.html` 时，语言切换与品牌链接均在
  `index.html` 与 `en/index.html` 之间正常跳转（站内链接不写目录形式，见 2026-11-07 变更记录）。

## 变更记录

| 日期       | 变更                                                                                 |
| ---------- | ------------------------------------------------------------------------------------ |
| 2026-11-02 | 创建。该需求最初误记入 Voxarium 仓库（SPEC-007 / T-043），同日迁移到本项目并删除误记 |
| 2026-11-07 | 回答 Q1～Q6（采用推荐项），状态改为 in-progress；新增 `site/`、`.github/workflows/pages.yml` 与 ADR-0024；完成 L1～L6、L8、L9 验收，L7 待部署 |
| 2026-11-07 | 修复 `file://` 直接打开时语言切换跳到目录索引：站内导航链接改为显式 `index.html`，不再依赖服务器目录索引 |
| 2026-11-07 | 下载区改为引导网盘（百度 / 夸克），与应用内更新检查一致；来源改为 Release 正文元数据，新增 ADR-0025；`resolve-downloads.mjs` 与测试改为解析网盘标记并在未配置时降级 |
| 2026-11-07 | 许可证落地（SPEC-0020 / ADR-0026）：页脚新增「许可证」链接与 GPL-3.0-or-later 声明，删去「本项目当前未声明开源许可证」，Q6 结论同步更新 |
| 2026-11-07 | 下载区两张网盘卡统一为相同边框与主按钮样式，提取码移到按钮之前 |
| 2026-11-07 | 移除「与旧版」关系说明区块及对应导航项，与旧版的关系改由页脚署名说明；需求第 1、4 条与设计要点同步调整 |
| 2026-11-07 | 下载区去掉「最新版本」占位，只保留「版本历史与 SHA256SUMS」链接；删除 `data-release-version` 占位与版本回填逻辑（`resolve-downloads.mjs`、`check-static.mjs` 与测试同步） |
| 2026-11-07 | 页脚去掉「旧版 BreakTimer」外链，旧项目只保留署名段落里的仓库链接 |
