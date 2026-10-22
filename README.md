# BreakTimer（重构）

BreakTimer 的重构项目。**文档先行，代码是成果**：先把目标和方案写清楚，代码是可再生的产出。

## 从这里读起

1. [`docs/overview.md`](docs/overview.md) —— 目标、范围、非目标
2. [`docs/roadmap.md`](docs/roadmap.md) —— 开发计划
3. [`docs/architecture.md`](docs/architecture.md) —— 现状与目标架构
4. [`AGENTS.md`](AGENTS.md) —— AI 协作约定（也定义了整个目录结构）

## 目录结构

```
docs/            一等公民文档：目标 / 架构 / 计划 / 规格 / 决策
.ai/             AI 记忆与会话日志（仅 AI 使用）
app/             新代码（成果）
breaktimer-app/  旧版源码（参考，只读）
```

## 跨设备开发

项目遵循「能复现的都入库」：文档、AI 记忆、代码、测试、配置与依赖锁文件都随 Git 同步；
只排除密钥、机器本地状态、依赖目录、构建产物与缓存。具体约定见
[`SPEC-0001`](docs/specs/0001-cross-device-git-baseline.md)。

新设备首次拉取：

```shell
git clone --recurse-submodules https://gitee.com/githunee/breaktimer-new.git
```

已克隆但尚未初始化旧源码时：

```shell
git submodule update --init --recursive
```

提交前可用 `git status --short --ignored` 检查是否有本应入库的文件被错误忽略。
