# 宣传页（`site/`）

BreakTimer-new 的对外单页宣传页：纯静态 HTML / CSS，中英双语，由
`.github/workflows/pages.yml` 发布到 GitHub Pages。需求见
[SPEC-0016](../docs/specs/0016-landing-page.md)，决策见
[ADR-0024](../docs/decisions/0024-landing-page-static-github-pages.md)。

本文件只给维护者看，不随站点发布（发布时 workflow 会从 `_site` 中删除）。

## 目录

| 路径                             | 作用                                                     |
| -------------------------------- | -------------------------------------------------------- |
| `index.html`                     | 简体中文主页（默认）                                     |
| `en/index.html`                  | 英文主页                                                 |
| `404.html`                       | 双语 404，使用 `/breaktimer-new/` 绝对路径               |
| `assets/styles.css`              | 两页共享样式（含暗色模式与移动端）                       |
| `assets/icon.png`、`icon-64.png` | 由 `app/public/icon.png` 缩放而来的站点图标              |
| `robots.txt`、`sitemap.xml`      | 爬虫规则与站点地图                                       |
| `scripts/check-static.mjs`       | 静态检查：无 `<script>`、无远程资源、无坏链              |
| `scripts/resolve-downloads.mjs`  | 部署时把最新 Release 下载直链写入副本                    |

## 本地检查

```powershell
node site/scripts/check-static.mjs site
node --test site/scripts/resolve-downloads.test.mjs
```

本地预览：`npx --yes serve site`。

## 约定

- 不引入构建器、远程字体、CDN、第三方统计、Cookie 或表单。
- 页面文案只描述 `README.md` 与 spec 已实现的能力。
- 图标源变化时重建两个站点图标（需要 ImageMagick 或等价工具）：

  ```powershell
  magick app/public/icon.png -resize 256x256 site/assets/icon.png
  magick app/public/icon.png -resize 64x64 site/assets/icon-64.png
  ```

- 换域名时同步修改 `index.html`、`en/index.html`、`404.html`、`robots.txt` 与
  `sitemap.xml` 中的绝对地址。
