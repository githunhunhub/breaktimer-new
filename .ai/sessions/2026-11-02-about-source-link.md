# 2026-11-02 About 项目源码链接改为 GitHub

## 背景

用户反馈：关于（About）对话框里的「项目源码」仍指向 `https://gitee.com/githunee/breaktimer-new`，
而 Gitee 后续不再使用，应改为 GitHub 主仓库。

## 改动

- `app/src-tauri/src/tray/mod.rs`：`about_content` 的当前项目源码链接改为
  `https://github.com/githunhunhub/breaktimer-new`，并同步更新两条 About 单元测试断言。
- `docs/specs/0013-app-rename.md`：需求第 6 条明确「项目源码指向 GitHub 主仓库」，变更记录补一行。

## 验证

`app/` 下全部门禁通过：

- `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（74 passed）、`pnpm build`
- `cargo fmt --all -- --check`、`cargo check --locked --all-targets`、
  `cargo test --locked --all-targets`（108 passed）

## 未处理（需用户确认）

- `release.ps1` 仍把 `master` 推送到 GitHub 与 Gitee，`README.md` / `DEVELOPMENT.md` 仍描述
  Gitee 备份职责（ADR-0014 / ADR-0015）。若确定彻底停用 Gitee，需要新增 ADR 取代相关结论，
  再改发布脚本与文档，并移除 `origin` 远程。
