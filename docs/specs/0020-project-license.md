# SPEC-0020：项目许可证与署名

- 状态：done
- 日期：2026-11-07
- 关联：ADR-0026 · SPEC-0016 · ADR-0024

## 背景 / 问题

上游 BreakTimer 以 GPL-3.0-or-later 发布。本项目复用了上游的应用图标、提示音资源与
UI 结构，构成 GPLv3 衍生作品；但仓库没有 `LICENSE`，应用内「关于」对话框已声明
`GPL-3.0-or-later`，宣传页页脚与 SPEC-0016 / ADR-0024 却写「本项目当前未声明开源
许可证」。三处说法互相矛盾，外部也无法判断可以如何使用与修改。

## 需求（做什么）

1. 仓库整体以 **GPL-3.0-or-later** 发布；根目录提供 `LICENSE`（GNU 官方 GPLv3 全文，
   逐字不改）。
2. 根目录 `NOTICE` 记录本项目版权、GPLv3（或更高版本）声明、无担保声明，以及上游署名
   与「已修改」说明。
3. `app/package.json` 与 `app/src-tauri/Cargo.toml` 声明 `GPL-3.0-or-later`。
4. 宣传页中英文页脚改为许可声明，并链接 `master` 分支的 `LICENSE`；仍满足纯静态、
   无远程资源的站点约束。
5. 根 `README.md` 增加「许可证」一节；`docs/` 中不再有「未声明许可证」的表述。
6. 应用内「关于」对话框保持与仓库声明一致（原本已是 `GPL-3.0-or-later`）。

## 验收标准（可测）

- [x] 根目录存在 `LICENSE`，与 <https://www.gnu.org/licenses/gpl-3.0.txt> 逐字一致
      （35149 字节，SHA256 以 `3972DC97` 开头）。
- [x] 根目录存在 `NOTICE`，含版权行、GPLv3 声明、上游署名与修改说明。
- [x] `app/package.json` 与 `app/src-tauri/Cargo.toml` 均含 `GPL-3.0-or-later`。
- [x] `site/index.html` 与 `site/en/index.html` 页脚声明 `GPL-3.0-or-later` 并链接
      `LICENSE`；`node site/scripts/check-static.mjs site` 通过。
- [x] 根 `README.md` 有「许可证」一节；SPEC-0016 与 ADR-0024 的说法不再宣称「未声明
      开源许可证」。
- [x] 应用内 `about.license` 文案仍为 `GPL-3.0-or-later`，相关 Rust 测试通过。

## 非目标 / 边界

- 不做双许可，不追加 GPL 例外条款（如链接例外）。
- 不把 `LICENSE` 复制进 `site/`，也不单独生成许可证页面。
- 本轮不改打包产物（NSIS 安装页、便携 ZIP 内的许可证副本）与「关于」对话框的许可证
  链接，见 ADR-0026「影响」。

## 实现计划

- [x] 新增 `LICENSE`（GNU 原文）与 `NOTICE`（版权、声明、上游署名）。
- [x] 元数据：`app/package.json`、`app/src-tauri/Cargo.toml`。
- [x] 站点：两个页面的页脚许可声明与链接、`site/README.md` 的同步约定。
- [x] 文档：ADR-0026、SPEC-0016 的 Q6 与变更记录、`docs/architecture.md` 代码地图、
      `docs/overview.md` 约束、根 `README.md`。
- [x] 验证：`node site/scripts/check-static.mjs site`；`app/` 下 `pnpm verify`。

## 验收记录

最近一次本地验收：2026-11-07（仓库 `<repo-root>`）。

| 检查 | 结果 |
| --- | --- |
| `LICENSE` 内容 | 与 `gpl-3.0.txt` 相同，35149 字节，SHA256 `3972DC97…36986` |
| `NOTICE` | 含 `Copyright (C) 2026 BreakTimer-new contributors`、GPLv3 或更高版本声明、上游署名与修改说明 |
| 许可元数据 | `app/package.json`、`app/src-tauri/Cargo.toml` 均为 `GPL-3.0-or-later` |
| `node site/scripts/check-static.mjs site` | 通过（无脚本、无远程资源、无坏链） |
| `node --test site/scripts/resolve-downloads.test.mjs` | 13 项通过 |
| `cd app; pnpm verify` | 通过（`format:check`、`lint`、`typecheck`、`test`、`build`、`cargo fmt` / `check` / `test`） |

## 变更记录

| 日期       | 变更                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| 2026-11-07 | 创建并完成：仓库整体采用 GPL-3.0-or-later，补 `LICENSE`、`NOTICE` 与站点 / 文档声明（ADR-0026） |
