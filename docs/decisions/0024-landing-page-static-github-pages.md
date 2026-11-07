# ADR-0024：宣传页采用仓库内静态站点与 GitHub Pages

- 状态：已接受
- 日期：2026-11-07
- 决策者：项目作者（按 SPEC-0016 推荐项实施）
- 关联：SPEC-0016 · SPEC-0015 · ADR-0011 · ADR-0013

## 背景

BreakTimer-new 需要一个对外的单页宣传页，作为项目的第一道门面。页面要能说明当前
Windows 版本的能力、下载方式、SmartScreen 处置与旧版关系，并托管在免费、可持续维护的
平台上。

项目的应用代码在 `app/`，文档事实源在 `docs/`。宣传页既不是应用运行时的一部分，也不应
引入前端构建器、依赖树或远程资源；同时它需要在 GitHub Pages 的项目子路径
（`/breaktimer-new/`）下正常加载。托管平台、目录位置与实现方式都需要留痕。

## 决策

1. 站点放在仓库根 `site/`，与应用代码、文档源分开；发布产物只包含该目录。
2. 使用纯静态 HTML / CSS，不引入框架、构建器或运行时依赖；样式、图标、脚本全部本地化，
   不使用远程字体、CDN、第三方统计、Cookie 或表单。
3. 中英双语使用两个静态页面：`site/index.html`（简体中文，默认）与
   `site/en/index.html`，共享 `site/assets/styles.css`；语言切换是普通链接，不依赖 JS。
4. 所有站内资源使用相对路径，按 GitHub Pages 项目子路径部署；固定基址暂定为
   `https://githunhunhub.github.io/breaktimer-new/`，不绑定自定义域名。
5. 托管使用 GitHub Pages，由新增的 `.github/workflows/pages.yml` 发布。发布只上传
   `site/` 的副本，不构建、不改写 `app/`，也不修改 `.github/workflows/release.yml`。
   Pages 的 Source 使用「GitHub Actions」，workflow 由 `master` 推送或手动触发。
6. 下载入口在静态页面中默认指向 GitHub Releases 页面；部署时运行
   `site/scripts/resolve-downloads.mjs`，读取最新 Release 并把 `*-setup.exe` /
   `*-portable.zip` 的直链写入发布副本。链接解析失败时部署失败，避免发布过期或错误的版本。
7. 旧项目仅作署名与链接，不复制其文案、图片、字体或站点代码；本轮不新增 `LICENSE`，
   页脚明确说明本项目当前未声明开源许可证。

## 理由

- 纯静态页面没有构建步骤，部署快、故障面小，也不会把站点依赖塞进 `app/` 的 pnpm / Cargo
  门禁；离线可用性天然满足「资源全部本地」的验收要求。
- `site/` 独立目录让「站点发布产物只有站点目录」成为目录结构约束，而不是靠发布脚本过滤。
- GitHub 已是唯一远程与发布平台（ADR-0017），复用 GitHub Pages 不需要新增账号、密钥或
  DNS 配置；Cloudflare Pages 可等有自定义域名或访问性能需求时再评估。
- 双语静态页比 JS 词条切换更利于首屏、SEO 与无脚本环境；代价是两份 HTML 需要同步维护，
  因此共享样式并把文案范围限制在 README 已描述的能力内。
- 部署时解析最新 Release 资产，避免每次发版手工改版本号；页面本身仍然是纯静态文件。

## 影响

- 新增 `site/`、`.github/workflows/pages.yml` 与 `site/scripts/resolve-downloads.mjs`；
  `docs/architecture.md` 的代码地图、`docs/overview.md` 与 `docs/roadmap.md` 同步记录。
- 仓库设置需要手动把 Pages Source 设为「GitHub Actions」；首次真实部署与 404、HTTPS、
  Lighthouse 验收仍需人工完成并回填 SPEC-0016。
- 若以后绑定自定义域名，需要同步修改 canonical / `hreflang` / sitemap 与 404 页的根路径，
  并把 `site/` 的资源引用保持为相对路径。
- 若以后新增 `LICENSE`，必须同步修改页脚许可说明与 README；在许可确定前不得宣称项目可自由
  使用或修改。
