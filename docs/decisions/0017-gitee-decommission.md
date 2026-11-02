# ADR-0017：停用 Gitee 远程，仅保留 GitHub

- 状态：accepted
- 日期：2026-11-02
- 决策者：项目维护者
- 关联：ADR-0014 · ADR-0015 · SPEC-0015

## 背景

ADR-0014 与 ADR-0015 把 Gitee 定位为 GitHub 之外的代码备份：日常 `develop` 与发版
`master` 同时推送到两个远程，发布脚本也要求 `master` 不落后于 Gitee。维护者已决定
后续不再使用 Gitee，双远程带来的是额外推送、同步检查与文档说明成本，而代码备份价值
低于维护成本。

## 决策

1. GitHub 是唯一远程仓库、唯一代码托管入口和唯一发布平台。
2. `develop` 与 `master` 只推送到 GitHub；不再推送到 Gitee。
3. 发布脚本只要求 `master` 跟踪并同步 `github/master`，只推送 `github master` 和发布 Tag。
4. 移除本地 `origin`（Gitee）远程配置；仓库文档、README 和 About 只引用 GitHub。
5. 本 ADR 取代 ADR-0014 的全部结论，以及 ADR-0015 中关于 Gitee 备份与双远程推送的
   第 4、5 条；ADR-0015 的 `develop` / `master` 分支模型保持不变。

## 理由

- 单一远程只保留一条可信来源，减少推送失败导致的半完成发布状态。
- 减少发布脚本和文档中的分支判断与同步检查。
- 用户下载、源码入口和自动化全部收敛到 GitHub，不再出现两个地址。

## 考虑过的替代方案

- **保持 Gitee 纯备份**：仍能多一份代码副本，但需要持续维护两个远程、双推检查和
  冗余文档，与维护者“不再使用 Gitee”的决定不符。
- **把备份迁到其他平台（如 GitLab / 自建 Gitea）**：备份有价值，但当前没有明确需求，
  且会重新引入双远程流程；将来若需要，另立 ADR。

## 影响

- 本地仓库仅保留 `github` 远程；新设备克隆地址使用
  `https://github.com/githunhunhub/breaktimer-new.git`。
- 历史提交与旧 Tag 不受影响；Gitee 上的既有镜像不再更新。
- 发布入口不再检查 Gitee 同步状态，也不再向 Gitee 推送 `master`。
