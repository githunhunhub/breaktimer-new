# 架构

## 现状（旧版 `breaktimer-app`）

> 参考旧仓库的 `breaktimer-app/CLAUDE.md`。

- Electron 桌面应用，常驻系统托盘，支持全屏休息覆盖层与通知。
- 主进程 `app/main/`：休息调度、IPC、设置持久化、托盘、窗口、通知、自启动。
- 渲染进程 `app/renderer/`：React 19 + Tailwind CSS + shadcn/ui。
- 技术栈：Electron 43、React 19、TypeScript 5.x、Vite（渲染进程）+ Webpack（主进程）。

## 目标架构（新版 `app/`）

<!-- TODO: 描述目标分层与模块划分 -->

## 与旧架构的关键差异

<!-- TODO -->
