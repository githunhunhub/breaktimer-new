# PLAN-0004：GitHub Tag 发布流水线实施计划

- 状态：in-progress
- 日期：2026-10-23
- 关联：SPEC-0015 · ADR-0013 · SPEC-0011 · SPEC-0012

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** 在 `master` 推送 `vX.Y.Z` Tag 时，校验版本与 Tag 来源，构建 Windows 安装包和
便携 ZIP，生成变更日志，并发布带校验文件的 GitHub Release。

**Architecture:** 本地发布脚本更新/校验四处版本并创建 Tag；单一 GitHub Actions Workflow
以 `meta -> build/changelog -> release` 串联。构建使用 `portable:build` 生成 release
executable 与便携 ZIP，再用 Tauri 复用 executable 生成 NSIS。`git-cliff` 从完整 Git
历史生成当前 Tag 的 Release Notes。

**Tech Stack:** Node.js 24、PowerShell 5.1+、pnpm 11、GitHub Actions、git-cliff、
Tauri v2、Rust 2024、Windows NSIS。

**Spec:** `docs/specs/0015-github-tag-release.md`

## Global Constraints

- 仅 `vMAJOR.MINOR.PATCH` Tag Push 触发；普通 push 不构建、不发布。
- Tag 提交必须已包含在 `origin/master`；CI 不自动改写版本文件。
- `package.json`、`tauri.conf.json`、`Cargo.toml`、`Cargo.lock` 四处版本必须一致。
- Workflow 默认 `contents: read`，仅 release Job 使用 `contents: write`。
- Release 只在 meta、Windows build、changelog 全部成功后创建。
- 构建与日志失败时不得留下公开 Release。
- 当前只生成 Windows x64 NSIS 与便携 ZIP；不签名、不自动更新、不构建 macOS/Linux。
- 不提交构建产物；首次正式 Tag 发布由用户另行明确触发。
- 人工验收和用户明确提交前不得创建或推送 `v0.1.0`。

## 文件边界

| 文件                                                 | 责任                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `app/scripts/release-version.mjs`                    | SemVer 规范化、四处版本读取/比较/更新                        |
| `app/scripts/release-version.test.mjs`               | 版本脚本纯函数与临时文件集成测试                             |
| `app/scripts/release-tag.ps1`                        | 本地分支、干净状态、上游同步、Tag 唯一性检查与 annotated Tag |
| `app/package.json`                                   | 暴露 `release:version`、`release:check`、`release:tag`       |
| `.github/cliff.toml`                                 | Conventional Commits 分组、版本范围与 Markdown 格式          |
| `.github/workflows/release.yml`                      | 唯一 Tag 发布入口和四个 Job                                  |
| `docs/specs/0015-github-tag-release.md`              | 需求与验收状态                                               |
| `docs/decisions/0013-github-tag-release-pipeline.md` | 版本与发布架构决策                                           |
| `docs/specs/README.md`                               | Spec 索引                                                    |
| `docs/roadmap.md`                                    | 后续需求状态                                                 |
| `docs/architecture.md`                               | 当前发布流水线说明                                           |
| `README.md`                                          | 用户下载与 SmartScreen 验证入口切换为 GitHub Releases        |

## Task 1：共享版本脚本

**Files:**

- Create: `app/scripts/release-version.mjs`
- Create: `app/scripts/release-version.test.mjs`
- Modify: `app/package.json`

**Interfaces:**

- Produces: `parseVersion(value): string`
- Produces: `replaceTomlPackageVersion(source, version): string`
- Produces: `replaceCargoLockVersion(source, version): string`
- Produces: `verifyVersions(expected, versions): void`
- Produces CLI: `release-version.mjs check <tag>` / `release-version.mjs set <version>`

- [x] **Step 1: 写失败测试**

```js
import { describe, expect, it } from "vitest";

import {
  parseVersion,
  replaceCargoLockVersion,
  replaceTomlPackageVersion,
  verifyVersions,
} from "./release-version.mjs";

describe("release version", () => {
  it.each(["0.1.0", "v1.2.3"])("accepts %s", (value) => {
    expect(parseVersion(value)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("updates only the BreakTimer-new package in Cargo.lock", () => {
    const source = [
      "[[package]]",
      'name = "breaktimer-new"',
      'version = "0.1.0"',
      "",
      "[[package]]",
      'name = "other"',
      'version = "0.1.0"',
    ].join("\n");

    expect(replaceCargoLockVersion(source, "1.2.3")).not.toContain(
      'name = "breaktimer-new"\nversion = "0.1.0"',
    );
    expect(replaceCargoLockVersion(source, "1.2.3")).toContain(
      'name = "other"\nversion = "0.1.0"',
    );
  });
});
```

- [x] **Step 2: 运行测试确认 RED**

Run: `pnpm exec vitest run scripts/release-version.test.mjs`

Expected: FAIL，因为脚本尚不存在。

- [x] **Step 3: 实现最小版本脚本**

- 只接受无前导零的三段数字 SemVer，可带一个前导 `v`。
- JSON 文件通过 `JSON.parse` / `JSON.stringify` 更新，保留两空格格式和结尾换行。
- Cargo 版本只更新 `[package]` 段；Cargo.lock 只更新名为 `breaktimer-new` 的
  `[[package]]`。
- `check` 同时读取四处版本，全部等于 Tag 后输出成功信息，否则一次性列出不一致项。
- `set` 写入四处后再次读取校验。

- [x] **Step 4: 运行测试确认 GREEN**

Run: `pnpm exec vitest run scripts/release-version.test.mjs`

Expected: PASS。

## Task 2：本地 Tag 脚本

**Files:**

- Create: `app/scripts/release-tag.ps1`
- Modify: `app/package.json`

**Interfaces:**

- Consumes: `node scripts/release-version.mjs check v<version>`
- Produces: annotated Tag `v<version>`，但不自动推送

- [x] **Step 1: 实现拒绝条件**

- 参数必须是合法版本或 `v` 前缀版本。
- 当前分支必须是 `master`。
- `git status --porcelain` 必须为空。
- 当前上游分支必须名为 `master`；fetch 后本地与上游必须为 `0 0`。
- 本地和远程都不得存在同名 Tag。

- [x] **Step 2: 创建并检查 Tag**

```powershell
git tag -a $tag -m "BreakTimer-new $tag"
git rev-parse --verify "refs/tags/$tag"
```

Expected: Tag 创建在 `master` HEAD，脚本只打印推送命令，不执行推送。

## Task 3：变更日志配置

**Files:**

- Create: `.github/cliff.toml`

**Interfaces:**

- Consumes: `GITHUB_REPO`、完整 Git 历史和 Tag。
- Produces: Markdown Release Notes，正文按新功能、修复、性能、重构、文档、测试、维护分组。

- [x] **Step 1: 配置 Conventional Commits**

- `tag_pattern = "v[0-9]+\\.[0-9]+\\.[0-9]+"`。
- 合并提交和不合规提交不进入正文。
- 当前版本使用 `--latest` 比较上一 Tag。
- 提交标题保留原始语言，短 SHA 使用反引号呈现。

- [x] **Step 2: 本地验证配置**

Run: `git-cliff --config .github/cliff.toml --unreleased --strip header`

Expected: 输出非空 Markdown，不包含模板错误。

## Task 4：GitHub Release Workflow

**Files:**

- Create: `.github/workflows/release.yml`

**Interfaces:**

- Produces Job: `meta`
- Produces Job: `build`
- Produces Job: `changelog`
- Produces Job: `release`
- Produces Artifact: `release-assets`
- Produces Artifact: `release-changelog`

- [x] **Step 1: 配置唯一触发与最小权限**

```yaml
on:
  push:
    tags:
      - "v[0-9]+.[0-9]+.[0-9]+"

permissions:
  contents: read
```

- [x] **Step 2: 校验 Tag 来源与版本**

- Checkout 使用 `fetch-depth: 0`。
- 显式 fetch `origin/master`。
- `git merge-base --is-ancestor "$GITHUB_SHA" refs/remotes/origin/master`。
- 运行 `node app/scripts/release-version.mjs check "$GITHUB_REF_NAME"`。
- 将去掉 `v` 的版本输出给 Release 名称。

- [x] **Step 3: 构建 Windows 产物**

- `windows-latest`、Node 24、pnpm 11.9.0、Rust stable。
- 依次运行 format、lint、typecheck、test、build、Rust fmt/check/test。
- 运行 `pnpm portable:build`，再运行
  `pnpm tauri bundle --bundles nsis --no-binary-patching`。
- 复制 NSIS 与 portable ZIP，生成 `SHA256SUMS.txt`，上传 `release-assets`。

- [x] **Step 4: 生成变更日志**

- `needs: meta`，Checkout `fetch-depth: 0`。
- `orhun/git-cliff-action@v4` 使用 `.github/cliff.toml` 和
  `-vv --latest --strip header`。
- `OUTPUT=CHANGES.md`；上传 `release-changelog` artifact。
- 日志为空时 Job 失败。

- [x] **Step 5: 最后创建 Release**

- `needs: [meta, build, changelog]`。
- 仅此 Job 设置 `permissions.contents: write`。
- 下载两个 artifact，验证资产数量与日志非空。
- 使用 `softprops/action-gh-release@v2` 创建公开 Release，上传 NSIS、ZIP、
  `CHANGES.md`、`SHA256SUMS.txt`。

- [x] **Step 6: 静态校验**

Run: `actionlint .github/workflows/release.yml`

Expected: PASS，无 shellcheck、表达式或 YAML 错误。

## Task 5：文档与自动化收口

**Files:**

- Modify: `docs/specs/0015-github-tag-release.md`
- Modify: `docs/plans/0004-github-tag-release.md`
- Modify: `docs/specs/README.md`
- Modify: `docs/roadmap.md`
- Modify: `docs/architecture.md`
- Modify: `README.md`
- Modify: `.ai/memory.md`
- Create: `.ai/sessions/2026-10-23-github-tag-release.md`

- [x] **Step 1: 执行自动化门禁**

```powershell
cd app
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
cd ..
cargo fmt --all --manifest-path app/src-tauri/Cargo.toml -- --check
cargo check --locked --all-targets --manifest-path app/src-tauri/Cargo.toml
cargo test --locked --all-targets --manifest-path app/src-tauri/Cargo.toml
git diff --check
```

- [x] **Step 2: 验证版本脚本**

```powershell
cd app
pnpm release:check v0.1.0
```

Expected: PASS，输出四处版本均为 `0.1.0`。

- [x] **Step 3: 更新状态与 AI 记录**

- SPEC-0015 保持 `in-progress`，R11 未勾选，等待首个正式 Tag。
- PLAN-0004 记录实际命令结果和未执行项。
- roadmap 标注“流水线已配置，待首个正式 Tag 验收”。
- 会话记录明确未创建 Tag、未推送正式 Release。

## 风险与边界

- 本地脚本可以被绕过，因此 CI 的独立 meta 校验不可删除。
- `git-cliff` 不收录非 Conventional Commits；合并提交本身被跳过。
- 首次 Tag 才会验证 Windows runner、NSIS、上传和 Release 权限的完整链路。
- 当前未签名安装包仍可能触发 SmartScreen。
- GitHub Actions 使用 major Tag 引用第三方 Actions；后续如提高供应链安全等级，可另立
  ADR 固定 commit SHA。

## 验证记录

- 2026-10-23：实现版本脚本、Tag 脚本、`git-cliff` 配置和 Release Workflow。
- 2026-10-23：`pnpm release:check v0.1.0` 通过，四处版本均为 `0.1.0`；同版本
  `release:version` 未产生额外文件差异。
- 2026-10-23：版本脚本 16 tests 通过；`release:tag` 在脏工作区按预期拒绝创建 Tag。
- 2026-10-23：`actionlint 1.7.12` 通过 `.github/workflows/release.yml`。
- 2026-10-23：`git-cliff 2.14.2` 使用 `.github/cliff.toml` 成功生成 Markdown；临时仓库
  以 `v0.0.1 -> v0.1.0` 验证 `--latest` 只输出当前版本范围。
- 2026-10-23：前端 format/lint/typecheck/test（70）/build 通过；Rust fmt/check/test（107）
  通过；`git diff --check` 通过。
- 2026-10-23：未执行本地 Tauri 打包，未创建或推送正式 Tag；R11 等待用户明确发布后验证。

## 变更记录

| 日期       | 变更                                                      |
| ---------- | --------------------------------------------------------- |
| 2026-10-23 | 创建并进入实现；采用严格版本一致性和单一 Release Workflow |
