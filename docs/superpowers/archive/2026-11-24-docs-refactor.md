# 文档体系轻量化迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `vibe-docs-standard.md` 将现有重型文档收敛为薄入口、架构地图、滚动日志和 Superpowers 需求闭环。

**Architecture:** 新 `AGENTS.md` 只保留路由、红线、完成定义和收尾协议；事实分别进入 `docs/architecture.md`、`docs/log/` 与 `docs/superpowers/`。旧目录本轮保留，供用户确认后再删除。

**Tech Stack:** Markdown、Git、PowerShell、Tauri v2、React、TypeScript、EdgeOne KV、GitHub Actions。

**Spec:** 用户本轮要求与外部 `vibe-docs-standard.md`；标准文件不复制进仓库。

## Global Constraints

- 不修改 `breaktimer-app/`。
- 不运行打包命令，不创建安装包。
- 本轮不删除旧文件；删除清单仅在完成后提交用户确认。
- `AGENTS.md` 不超过 80 行，`docs/log/progress.md` 不超过 80 行。
- 文档不写真实用户名或本机绝对路径。
- 只改文档，不运行 `pnpm verify`，完成后检查链接、索引、状态和行数。

---

### Task 1: 固化新入口与常驻事实

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/architecture.md`
- Create: `docs/log/progress.md`
- Create: `docs/log/decisions.md`

**Interfaces:**
- Consumes: 现有 `README.md`、`DEVELOPMENT.md`、`docs` 和 ADR 中的命令、模块职责、平台限制。
- Produces: 后续会话仅读四个入口文件即可定位命令、架构、当前状态和已否决方案。

- [x] **Step 1: 重写 `AGENTS.md`**，保留项目定位、命令、渐进读取、红线、收尾协议，控制在 80 行内。
- [x] **Step 2: 重写 `docs/architecture.md`**，只保留目录职责、数据流、代码地图、不变量、外部平台踩坑。
- [x] **Step 3: 创建 `docs/log/progress.md`**，记录当前完成项、未完成项和 2～3 行近期记录。
- [x] **Step 4: 创建 `docs/log/decisions.md`**，只保留仍有效的技术选型、取舍和已否决方案。

### Task 2: 建立 Superpowers 需求闭环

**Files:**
- Create: `docs/superpowers/specs/0015-github-tag-release.md`
- Create: `docs/superpowers/specs/0018-installation-metrics.md`
- Create: `docs/superpowers/specs/0022-public-metrics-dashboard.md`
- Create: `docs/superpowers/specs/0024-nsis-installer-languages.md`
- Create: `docs/superpowers/specs/0025-public-report-read-performance.md`
- Create: `docs/superpowers/plans/0004-github-tag-release.md`
- Create: `docs/superpowers/archive/0001-app-scaffold.md`
- Create: `docs/superpowers/archive/0002-implementation-phases.md`
- Create: `docs/superpowers/archive/0003-multilingual-support.md`
- Create: `docs/superpowers/archive/0026-public-report-snapshot-refresh.md`

**Interfaces:**
- Consumes: 现有 `docs/specs/` 与 `docs/plans/` 的状态。
- Produces: `specs/` 仅含 5 个进行中需求，`plans/` 仅含 1 个进行中计划，完成或取代项进入 `archive/`。

- [x] **Step 1: 复制 5 个 `in-progress` SPEC 到 `docs/superpowers/specs/`。**
- [x] **Step 2: 复制仍在进行的 PLAN-0004 到 `docs/superpowers/plans/`。**
- [x] **Step 3: 复制 PLAN-0001～0003 与 superseded SPEC-0026 到 `docs/superpowers/archive/`。**
- [x] **Step 4: 检查新位置中的相对链接，不修改历史验收正文。**

### Task 3: 更新入口链接并验证

**Files:**
- Modify: `DEVELOPMENT.md`

**Interfaces:**
- Consumes: Task 1 与 Task 2 的新路径。
- Produces: 开发入口不再把旧 `overview/roadmap/specs/decisions` 作为默认阅读链。

- [x] **Step 1: 更新 `DEVELOPMENT.md` 的「从这里读起」和目录结构。**
- [x] **Step 2: 检查 `AGENTS.md` 与 `progress.md` 行数。**
- [x] **Step 3: 检查新文档中的 Markdown 相对链接与旧路径引用。**
- [x] **Step 4: 运行 `git status --short`，确认没有代码、构建产物或打包产物进入改动。**
- [x] **Step 5: 将本计划移至 `docs/superpowers/archive/`，保持 `plans/` 只放活跃计划。**
