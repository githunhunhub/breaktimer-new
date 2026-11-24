# BreakTimer-new 开发与 AI 协作规范

## 1. 项目概览与常用命令

- **项目定位**：Windows 10/11 x64 桌面休息提醒应用，支持全屏休息窗、通知、托盘、工作时段、自启动、中英双语与更新检查。
- **技术栈**：Tauri v2 + Rust + React 19 + TypeScript + Tailwind CSS + shadcn/ui；统计服务使用 EdgeOne Edge Functions + KV + HLL。
- **启动开发**：`cd app && pnpm tauri:dev`
- **完整门禁**：`cd app && pnpm verify`
- **宣传页检查**：`node site/scripts/check-static.mjs site && node --test site/scripts/resolve-downloads.test.mjs`
- **统计服务测试**：`cd server/metrics && npm test`
- **发布与打包**：只在用户明确授权后执行；完整步骤见 `DEVELOPMENT.md`。

## 2. 渐进式文档读取路由

- **局部修复 / 样式调整**：只读目标源码；若涉及需求或设计变化，先更新 `docs/superpowers/specs/`。
- **新需求或方案设计**：读 `docs/architecture.md`，按需查 `docs/log/decisions.md`，先写当前 SPEC。
- **执行计划**：只读当前 `docs/superpowers/plans/*.md`、关联 SPEC 与目标源码。
- **跨会话续做**：先读 `docs/log/progress.md` 顶部的「当前进行中」。
- **默认禁读**：`docs/superpowers/archive/`；仅用户明确要求追溯历史时读取。

## 3. 文档工作流

- 活跃需求和计划只放 `docs/superpowers/{specs,plans}/`；完成或废弃后移入 `archive/`。
- SPEC 只写目标、做/不做、验收与必要实现步骤，不写企业级套话。
- 长期有效取舍写 `docs/log/decisions.md`，每条只写结论与一句原因；旧决策被推翻时直接替换。
- 目录、数据流、核心模块或外部依赖变化时同步 `docs/architecture.md`。
- `docs/` 用中文；代码标识符、注释和测试名用英文；用户可见文案放 `app/locales/`。
- 文档不得写入真实用户名或本机绝对路径，统一用 `%APPDATA%`、`%USERPROFILE%`、`<repo-root>`。

## 4. 不可违反

1. **旧源码只读**：不得修改 `breaktimer-app/`。
2. **文档先行**：需求或设计有变化时，先更新 SPEC/架构/决策，再改 `app/`。
3. **打包授权**：只有用户明确要求“打包”或生成安装包时，才执行 `tauri:build`、`portable:build` 或 bundle。
4. **分支边界**：日常开发、提交和推送用 `develop`；`master` 只用于发版合入、版本提交和发布 Tag。
5. **跨设备同步**：可复现的文档、代码、测试、配置与锁文件必须入库；只忽略密钥、本地状态、依赖和构建产物。
6. **安全与隐私**：不提交密钥、令牌、IP、明文 `installId` 或逐客户端统计；统计只上报白名单字段。
7. **AI 文档边界**：AI 文件只放仓库根或 `docs/`，不得写入 `app/`。

## 5. 完成定义

- 改代码后在 `app/` 执行 `pnpm verify`；依赖变化时先执行 `pnpm install --frozen-lockfile`。
- 只改文档时检查链接、索引、状态、示例命令与篇幅上限，不运行代码门禁。
- 文档与实现冲突时以实现为准，并在同一次提交里先修文档。

## 6. 收尾协议

用户发送“收尾”时：

1. 将已完成 SPEC/计划移入 `docs/superpowers/archive/`。
2. 清空 `docs/log/progress.md` 的当前断点，并追加 2～3 行完成摘要；超过 80 行时压缩最早记录。
3. 涉及结构、数据流或核心模块变化时更新 `docs/architecture.md`。
4. 有新的长期取舍或平台坑点时补充 `docs/log/decisions.md`。
