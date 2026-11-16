# AGENTS.md

> 本文件是 AI 协作的唯一入口。开工顺序：本文件 → `docs/overview.md` →
> `docs/roadmap.md` → `docs/architecture.md` → 相关 SPEC。找取舍查
> `docs/decisions/README.md`，找文件查 `docs/architecture.md` 的「代码地图」，
> 找术语查 `docs/glossary.md`。
> 用户说明看 `README.md`，完整开发命令看 `DEVELOPMENT.md`。
>
> 核心理念：**文档先行，代码是成果**。历史取舍见 ADR-0001、ADR-0021、ADR-0022。

## 不可违反

1. **文档先行**：改代码前先读 `docs/overview.md` 与相关 SPEC；需求或设计有变动，先改
   `docs/`，再改 `app/`。
2. **单一事实源**：里程碑状态写 `docs/roadmap.md`，需求与验收写对应 SPEC，长期取舍写 ADR；
   不维护 AI memory、会话日志、提示词日志或私有验收清单。
3. **AI 文档边界**：AI 相关文件只放在仓库根或 `docs/`，不得写进 `app/`。当前只把本文件
   作为常驻 AI 入口；不创建其他工具的镜像规则，工具专属配置仅在确有必要时保留并指回本文件。
4. **决策留痕**：ADR 编号递增、只增不改，并同步 `docs/decisions/README.md`；被推翻时新增
   ADR，用「取代 / 部分取代」引用旧记录。
5. **旧源码只读**：不修改 `breaktimer-app/` 内任何内容。
6. **跨设备同步**：可从仓库复现的文档、代码、测试、配置与锁文件必须纳入 Git；只排除密钥、
   机器本地状态、依赖目录、构建产物与缓存。新增忽略规则时必须写明重建或恢复方式。
7. **打包需显式授权**：只有用户明确要求“打包”或生成安装包、发布包时，才执行 `tauri:build`、
   `portable:build`、bundle 等命令；验证中的前端 `pnpm build` 不算打包。
8. **分支边界**：日常开发、提交和推送使用 `develop`；`master` 只用于发版合入、版本提交与
   创建发布 Tag。细则见 `DEVELOPMENT.md` 与 ADR-0015。

## 文档工作流

- 确认需求时新建或更新 SPEC，状态按 `draft → confirmed → in-progress → done` 演进，并同步
  `docs/specs/README.md`；改动写入该 SPEC 的「变更记录」。
- 小需求的实现计划写进 SPEC「实现计划」；跨多个 SPEC 时才新建 `docs/plans/`，并同步索引。
- 引用方向固定为 `plan → spec → ADR`；代码和测试注释引用 SPEC 编号。
- 文档与实现冲突时以实现为准，并在同一次提交里先修文档。
- 文档不得写入真实用户名或本机绝对路径，统一使用 `%USERPROFILE%`、`%APPDATA%`、
  `<repo-root>` 等占位符。
- `docs/` 与提交摘要用中文；代码标识符、注释和测试名用英文；用户可见文案走 `app/locales/`。
- 琐碎改动不建 SPEC；只为有长期价值的需求建档。

## 完成定义

- 改代码后，在 `app/` 执行 `pnpm verify`。门禁依次检查格式、Lint、类型、测试、前端构建以及
  Rust 格式、检查和测试；任一失败即未完成。依赖变更时先执行
  `pnpm install --frozen-lockfile`。
- 只改文档时自检链接、索引、状态与示例命令，不运行代码门禁。
- 打包不在验证门禁内，步骤见 `DEVELOPMENT.md`。

## 提交与推送

- 提交前执行 `git status --short`，确保没有临时文件、构建产物或应忽略文件。
- 一次提交只做一件事，使用 Conventional Commits：
  `<type>(<scope>): <摘要>`，type 取 `feat` / `fix` / `docs` / `test` / `ci` /
  `chore` / `refactor`。
- 中文提交信息通过 UTF-8 文件配合 `git commit -F <文件>` 写入，不使用 `git commit -m`。
- 日常推送 `develop` 到 `github`；`master` 只按发布流程操作。
