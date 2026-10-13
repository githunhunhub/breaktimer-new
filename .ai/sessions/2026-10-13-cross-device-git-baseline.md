# 2026-10-13：跨设备 Git 管理基线

## 上下文

项目会在两台电脑上交替开发，用户要求所有能纳入 Git 管理的项目内容都纳入 Git。

## 结论

- 建立 SPEC-0001，确认「能仅凭仓库复现的内容全部入库」的原则。
- 通过 `.gitattributes` 统一仓库换行，通过 `.editorconfig` 统一编辑器编码与缩进。
- `.gitignore` 继续排除密钥、机器本地状态、依赖、构建产物、缓存与日志；VS Code 共享配置改为白名单跟踪。
- `breaktimer-app/` 保持为固定提交的 Git submodule，新设备使用 `--recurse-submodules` 克隆或执行 `git submodule update --init --recursive`。
- `README.md` 与 `AGENTS.md` 已补充跨设备协作约定。

## 验证

- `git status --short --ignored` 确认没有被隐藏的项目内容。
- `git ls-files` 确认已有文档、AI 记忆与会话均在跟踪清单中。
- `git submodule status` 确认旧源码固定在 `2d672434`；执行 `git submodule update --init --recursive` 后工作区已恢复。
- `git check-ignore` 确认 `.vscode/settings.json` 等共享配置可入库，而 `.env`、个人状态与 `node_modules/` 仍被排除。

## 待续

- `app/` 初始化后提交源码、配置与依赖锁文件。
- 推送本轮变更到 `origin`。
