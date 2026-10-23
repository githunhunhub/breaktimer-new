# 2026-10-23 用户版 README 调整

## 范围

- 将根 `README.md` 从开发/AI 入口改为面向实际用户的 Windows 安装与使用说明。
- 保留原 README 的开发、文档和跨设备协作内容，并迁移到 `DEVELOPMENT.md`。
- 不修改 `app/` 代码、应用文案或发布产物。

## 已完成

- 新 README 包含产品简介、主要功能、下载与安装、便携版说明、快速开始、系统要求、
  常见问题和开发入口。
- 下载入口指向 Gitee Releases；安装版说明包含未签名与 SmartScreen 提示。
- 便携版说明包含目录完整性、`data\`、重置与移动目录后的自启动操作。
- 原开发内容完整迁移到 `DEVELOPMENT.md`，并在根 README 底部保留入口。
- SPEC-0001 中关于根 README 提供克隆与 submodule 命令的引用已同步到
  `DEVELOPMENT.md`，并追加变更记录。

## 检查

- `README.md`、`DEVELOPMENT.md` 的本地链接与图标路径均存在。
- Prettier Markdown 格式检查通过。
- `git diff --check` 通过。
- Gitee Releases 页面自动访问被 Gitee 以 403 拒绝，未做自动化页面内容验证。
- 本次仅改文档，未运行前后端测试。

## 待续

- 未收到提交指令，不执行 Git 提交或推送。
