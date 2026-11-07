# ADR-0026：项目整体采用 GPL-3.0-or-later 并补齐许可证与署名

- 状态：已接受
- 日期：2026-11-07
- 决策者：项目作者
- 关联：SPEC-0020 · SPEC-0016 · ADR-0024（部分取代其第 7 条）

## 背景

上游 BreakTimer（`tom-james-watson/breaktimer-app`）以 GPL-3.0-or-later 发布，
其 `LICENSE.md` 为 GPLv3 全文，`package.json` 声明 `"license": "GPL-3.0-or-later"`。

BreakTimer-new 虽然用 Tauri 重写，但实际复用了上游内容：`app/public/icon.png` 与上游
`resources/icon.png` 字节完全相同；`app/src-tauri/sounds/` 下十个音效与上游
`app/renderer/public/sounds/` 同名文件字节相同；设置窗与休息窗 UI 由旧 renderer
组件移植而来。按 GPLv3，这些内容使整个分发物构成衍生作品。

与此同时，仓库当时没有 `LICENSE`，而应用内「关于」对话框（`app/locales/*.json` 的
`about.license`、`tray/mod.rs`）已经声明 GPL-3.0-or-later，宣传页页脚却写「本项目当前
未声明开源许可证」（ADR-0024 第 7 条 / SPEC-0016 Q6）。三处说法互不一致，第三方无法
判断能否使用与修改。

## 决策

1. 仓库整体（应用、宣传页、统计端点与文档）以 **GPL-3.0-or-later** 发布，不做双许可，
   不追加额外条款。
2. 根目录新增 `LICENSE`，内容为 GNU 官方 GPLv3 全文
   （<https://www.gnu.org/licenses/gpl-3.0.txt>，35149 字节），逐字不改，不在正文里
   插入版权行。
3. 根目录新增 `NOTICE`：本项目版权、GPLv3「或更高版本」声明、无担保声明，以及上游
   署名与「已修改」说明（GPLv3 §5(a) 要求）。
4. `app/package.json` 与 `app/src-tauri/Cargo.toml` 增加 `GPL-3.0-or-later` 许可
   元数据；`app/package.json` 保持 `"private": true`。
5. 宣传页页脚改为许可声明，并链接 `master` 分支的 `LICENSE`；`LICENSE` 不复制进
   `site/`，避免两份许可证文本漂移。
6. 应用内「关于」对话框文案保持 GPL-3.0-or-later，本轮不追加许可证链接。

## 理由

- 复用上游图标、音效与 UI 移植已使本项目成为 GPLv3 衍生作品，MIT / Apache-2.0 / 闭源
  都不可行，GPLv3 是唯一合法选项。
- 选 `or-later` 而非 `only`：上游声明与项目内既有文案都是 or-later，保持上下游一致，
  也便于以后与其它 GPLv3+ 项目互相复用。
- `LICENSE` 保持 GNU 原文、版权与署名放 `NOTICE` / `README.md`：GPLv3 明确不允许修改
  许可证正文，署名与修改说明也需要一个独立、易查的位置。
- 站点用 GitHub 链接而不是复制正文：Pages 只发布 `site/`，复制正文会引入第二份需要
  同步维护的许可证文本。
- 保持 `private: true`：项目不以 npm 包形式发布，`license` 字段只用于声明与工具识别。

## 影响

- 任何分发（安装包、便携 ZIP、源码镜像）都必须随附许可证并提供获取源码的方式。本轮
  没有把 `LICENSE` 打进安装包与便携 ZIP，作为后续打包事项在 SPEC-0011 / SPEC-0012
  跟进。
- 部分取代 ADR-0024 第 7 条（「本轮不新增 `LICENSE`，页脚说明未声明」）；页脚许可
  说明、`README.md` 与 `site/README.md` 的约定必须同步，见 SPEC-0020。
- 之后新引入的上游 GPL 资产要在 `NOTICE` 登记；新增依赖必须与 GPLv3 兼容，不得引入
  不兼容许可证。
- 允许商业分发，但衍生作品必须同样以 GPLv3 开放源码，不得把本项目并入闭源产品。
