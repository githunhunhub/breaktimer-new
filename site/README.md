# 宣传页（`site/`）

BreakTimer-new 的对外单页宣传页：纯静态 HTML / CSS，中英双语，由
`.github/workflows/pages.yml` 发布到 GitHub Pages。需求见
[SPEC-0016](../docs/superpowers/archive/0016-landing-page.md)，有效取舍见
[`docs/log/decisions.md`](../docs/log/decisions.md)。

本文件只给维护者看，不随站点发布（发布时 workflow 会从 `_site` 中删除）。

## 目录

| 路径                             | 作用                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `index.html`                     | 简体中文主页（默认）                                     |
| `en/index.html`                  | 英文主页                                                 |
| `404.html`                       | 双语 404，使用 `/breaktimer-new/` 绝对路径               |
| `assets/styles.css`              | 两页共享样式（含暗色模式与移动端）                       |
| `assets/logo.svg`、`favicon.svg` | 品牌图标与站点 favicon，源图见 `app/assets/logo.svg`    |
| `assets/icon.png`、`icon-64.png` | 由同一品牌源导出的 Apple touch icon 与 OG 分享图        |
| `robots.txt`、`sitemap.xml`      | 爬虫规则与站点地图                                       |
| `scripts/check-static.mjs`       | 静态检查：无远程脚本、无远程资源、无坏链                |
| `scripts/resolve-downloads.mjs`  | 部署时把最新 Release 的百度 / 夸克网盘链接写入副本       |

## 本地检查

```powershell
node site/scripts/check-static.mjs site
node --test site/scripts/resolve-downloads.test.mjs
```

本地预览：`npx --yes serve site`。

也可以直接双击 `site/index.html` 用 `file://` 打开：站内链接都指向具体的
`index.html` 文件（不写 `en/`、`./` 这类目录形式），因为浏览器不会为目录自动补
`index.html`。`404.html` 使用 `/breaktimer-new/` 绝对路径，只在 Pages 子路径部署时生效。

## 约定

- 不引入构建器、远程字体、CDN、第三方统计、Cookie 或表单。
- 页面文案只描述 `README.md` 与 spec 已实现的能力。
- 页脚的许可声明（GPL-3.0-or-later）必须与根目录 `LICENSE`、`NOTICE` 和
  `README.md` 的「许可证」一节保持一致；链接固定指向 `master` 分支的 `LICENSE`，
  因为 `LICENSE` 不随站点发布（见 SPEC-0020 / ADR-0026）。
- 下载入口是百度网盘与夸克网盘，链接来自最新 Release 正文的隐藏标记
  `<!-- breaktimer-downloads {"baidu":"...","quark":"...","baiduCode":"..."} -->`
  （与 SPEC-0017 同源，由 `app/scripts/release-downloads.mjs` 依据
  `.github/release-downloads.json` 生成）。标记缺失或字段为空时对应卡片隐藏，
  页面显示「暂未配置」提示并保留 GitHub Releases 兜底；链接必须是 `https` 且主机为
  `pan.baidu.com` / `pan.quark.cn`，否则部署失败。
- 品牌图标源为 `app/assets/logo.svg`。修改后从 `app/` 执行以下命令重新生成应用与站点资产
  （需要已安装 Microsoft Edge 或 Chrome，也可用 `BREAKTIMER_EDGE_PATH` 指定浏览器）：

  ```powershell
  pnpm render:logo
  ```

- 换域名时同步修改 `index.html`、`en/index.html`、`404.html`、`robots.txt` 与
  `sitemap.xml` 中的绝对地址。
