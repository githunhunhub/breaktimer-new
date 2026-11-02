# 2026-11-02 记录宣传页需求（SPEC-0016）

## 背景

用户要求给应用做一个宣传页，版式暂时参考 <https://breaktimer.app/>，计划托管到 GitHub Pages
或 Cloudflare Pages。该需求起初被误记到另一个项目（Voxarium 仓库）的 `docs/specs`，
用户指出后迁移到本仓库，误记内容已删除。

## 改动

- 新增 `docs/specs/0016-landing-page.md`（`draft`）：区块映射、L1~L9 验收、非目标，
  以及六项开放问题（Q1 站点目录、Q2 托管平台、Q3 域名、Q4 语言、Q5 截图素材、
  Q6 `LICENSE` 与署名）。
- `docs/specs/README.md`：索引表追加 SPEC-0016 一行。
- `docs/roadmap.md`：后续需求追加 SPEC-0016。
- `.ai/memory.md`：未决事项与最近会话入口同步。

## 待用户确认

- 现状：仓库公开但**没有 `LICENSE`**，而参考站（旧版项目官网）内容为 GPLv3；公开站点页脚写
  什么许可、是否补 `LICENSE`，需要先定（Q6）。
- 站点目录放仓库根 `site/` 还是独立仓库（Q1），决定后续「涉及文件」边界。
- 托管平台与域名（Q2 / Q3）、是否中英双语（Q4）、截图与图标素材来源（Q5）。

## 验证

仅文档改动：未跑 `app/` 门禁；已核对链接目标存在、索引表与 spec 编号连续（0015 → 0016）。
