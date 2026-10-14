# ADR-0005：系统空闲与锁屏状态采集

- 状态：accepted
- 日期：2026-10-14
- 关联：SPEC-0003 · SPEC-0005

## 背景

阶段 3 需要让调度器消费真实的系统空闲与锁屏状态。该能力依赖操作系统：

- Windows 可通过 `GetLastInputInfo` 获取空闲时长，通过输入桌面句柄判断当前桌面是否锁定。
- macOS 可获取 HID idle time，但没有轻量、稳定且无需额外权限的通用锁屏查询。
- Linux 的 X11 与 Wayland 空闲查询机制不同，锁屏状态还依赖桌面环境/会话服务。
- Electron 旧版的 `powerMonitor.getSystemIdleState` 在 Tauri v2 中没有等价的单一 API。

如果把平台查询直接写进 `BreakScheduler`，状态机将无法稳定测试，锁屏语义也会与普通空闲重置纠缠。

## 决策

1. 保持 `BreakScheduler` 为纯状态机。每次 tick 接收 `SchedulerContext`，其中包含：
   - 当前是否处于工作时段；
   - 系统状态（active、idle、locked、unavailable）；
   - 空闲时长；
   - tick 时间。
2. 平台采集放在 `SystemStateProvider` 后面，由 Rust 后端基础设施实现，不进入状态机。
3. 空闲时长使用 `system-idle-time`：它支持 Windows、macOS、Linux X11 与 Wayland。
4. Windows 使用 `OpenInputDesktop` 做锁屏探测；探测失败或运行在尚未实现锁屏查询的平台时，返回 `unavailable/unlocked`，并由空闲时长与 tick 间隔继续保证不补发过期休息。
5. 所有条件逻辑通过注入的上下文测试，不依赖真实系统空闲或锁屏。

## 取舍

- **选择上下文注入而非 OS 全局状态**：增加了一个 provider 抽象，但让工作时段、闲置、锁屏和休眠恢复都能用确定性时间测试。
- **选择 `system-idle-time` 而非只支持 X11 的旧库**：Linux 依赖体积更大，但避免 Wayland 上完全失效。
- **锁屏检测先只做 Windows 真探测**：macOS/Linux 的完整锁屏查询需要平台专用框架或会话服务，留作跨平台验收时补全；当前行为在锁屏期间仍可依赖空闲时长避免补发，不会把锁屏误当成用户活跃。

## 后果

- 调度器测试可以精确覆盖边界、通知和长时间不可响应，不产生平台 flaky。
- Windows 上锁屏与普通闲置可区分处理；macOS/Linux 上锁屏按长时间空闲处理，平台限制需在 SPEC-0005 与架构文档中记录。
- 后续若加入托盘或通知模式，可复用同一 `SchedulerContext`，不需要再次改状态机接口。
