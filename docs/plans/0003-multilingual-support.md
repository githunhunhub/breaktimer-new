# PLAN-0003：多语言支持实施计划

- 状态：done
- 日期：2026-10-23
- 关联：SPEC-0014 · ADR-0012

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 React 与 Rust 共用 `app/locales/*.json`，首版支持 `en-US` / `zh-CN`，并在保存设置后即时切换所有已打开界面、托盘和后续系统通知。

**Architecture:** `en-US` 是唯一基准与最终回退语言。React 通过 `import.meta.glob` 自动发现资源，提供无第三方框架的 `I18nProvider` / `useI18n()`；Rust 通过 `include_dir` 嵌入同一目录，并在启动时固定系统语言。设置只保存 `language: string | null`，有效 locale 由 Rust 计算；保存导致有效 locale 变化时广播 `locale-changed`。

**Tech Stack:** React 19、TypeScript 6、Vitest、Tauri v2、Rust 2024、Serde、`include_dir`、`sys-locale`。

**Spec:** `docs/specs/0014-multilingual-support.md`

## Global Constraints

- 唯一翻译源是 `app/locales/<locale>.json`；React 与 Rust 不得各维护一份文案。
- `en-US` 是基准和最终回退；未知 locale、缺失 key 和非基准损坏资源都回退英文。
- 消息只支持 `{name}` 插值与 `one` / `other`；`count === 1` 选 `one`，其余情况（含 `0`、负数和大于 `1`）选 `other`。
- 不引入 ICU MessageFormat、ICU4X、`react-i18next` 或其他 i18n 框架。
- `language: null` 表示跟随系统；系统语言只在应用启动时解析，运行期间修改系统语言需重启。
- 语言草稿不即时生效；只有设置页 `Save` 持久化成功后才切换界面。
- 保存后设置页、已打开休息页与托盘立即更新；系统通知从下一次触发开始使用新语言。
- 用户自定义休息标题和消息原样显示。只有值精确等于 `en-US` 的旧内置默认文案时才使用当前语言的内置翻译。
- 产品名 `BreakTimer-new`、版本号、URL、许可证标识、语言原生名称和底层技术错误保持原样。
- 不实现 RTL、日期/数字/货币本地化、运行时语言包、在线翻译或翻译编辑器。
- Windows 是当前人工验收平台；不执行 `tauri:build`、`portable:build`、bundle 或生成安装包，除非用户另行明确授权。
- 开始实现前先检查 `git status` 并保留所有无关改动；若工作区已有探索性 i18n 草稿，以本计划接口为准，不得并行保留两套实现。
- 遵守 user-facing 文案不截断、不重叠的要求；新增普通 LTR 语言只增加 JSON 并重新构建。
- 人工验收通过前不提交或推送。

## 文件边界

| 文件                                            | 责任                                                          |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `app/locales/en-US.json`                        | 基准 locale、语言原生名、别名和全部英文 messages              |
| `app/locales/zh-CN.json`                        | 简体中文 messages                                             |
| `app/src/lib/i18n.tsx`                          | React 资源发现、catalog、`translate()`、Provider、`useI18n()` |
| `app/src/lib/i18n.test.ts`                      | React 翻译、回退、插值、复数、损坏资源和 key 完整性           |
| `app/src/lib/ipc.ts`                            | `get_i18n_state` 与 `locale-changed` 类型封装                 |
| `app/src/main.tsx`                              | 在应用根节点包一层 `I18nProvider`                             |
| `app/index.html`                                | 初始文档语言使用基准 locale `en-US`                           |
| `app/src/types/i18n.ts`                         | `I18nState` 与前端 IPC 类型                                   |
| `app/src/types/settings.ts`                     | 增加 `language: string \| null`                               |
| `app/src/components/settings/language-card.tsx` | `System` 页签语言选择卡片                                     |
| `app/src/components/settings/*.tsx`             | 设置页全部固定文案与小范围 ARIA                               |
| `app/src/components/settings/working-hours.ts`  | 星期标签改为稳定翻译 key                                      |
| `app/src/components/break/break-window.tsx`     | 休息页文案、默认标题/消息映射                                 |
| `app/src/components/break/utils.ts`             | “距上次休息”使用共享文案与单位                                |
| `app/src-tauri/Cargo.toml`                      | 增加 `include_dir` 与 `sys-locale`                            |
| `app/src-tauri/src/i18n/mod.rs`                 | Rust 资源解析、locale 解析、翻译、`I18nState`                 |
| `app/src-tauri/src/state/settings.rs`           | Rust 设置增加 `language: Option<String>`                      |
| `app/src-tauri/src/state/mod.rs`                | 保存系统 locale，提供有效 locale 与 `I18nState`               |
| `app/src-tauri/src/commands.rs`                 | 新增 `get_i18n_state`，保存后广播 locale 变化                 |
| `app/src-tauri/src/flow.rs`                     | 通知文案本地化，广播 `locale-changed`                         |
| `app/src-tauri/src/tray/mod.rs`                 | 托盘、About 与动态状态文案本地化；保持稳定根菜单              |
| `app/src-tauri/src/lib.rs`                      | 启动时检测系统语言、注入 `AppState`、注册 command             |

## 接口契约

### TypeScript

```ts
export interface Language {
  locale: string;
  name: string;
}

export type MessageParams = Record<string, string | number>;
export type Translate = (key: string, params?: MessageParams) => string;

export interface I18nState {
  language: string | null;
  effectiveLocale: string;
}

export interface I18nClient {
  getI18nState: () => Promise<I18nState>;
  onLocaleChanged: (handler: (state: I18nState) => void) => Promise<() => void>;
}

export function availableLanguages(): Language[];
export function translate(
  locale: string,
  key: string,
  params?: MessageParams,
): string;
export function messageKeys(locale: string): string[];
export function useI18n(): {
  locale: string;
  t: Translate;
  languages: Language[];
};
```

`I18nProvider` 接收 `children`、可选 `initialLocale`（默认 `en-US`）和可选 `client`（默认 `ipc`）。没有 Provider 时 `useI18n()` 必须返回英文上下文，保证现有组件测试可直接渲染。Provider 在挂载时读取 `getI18nState`、订阅 `locale-changed`，并同步 `document.documentElement.lang`。

### Rust

```rust
pub fn system_locale() -> String;
pub fn resolve_locale(preference: Option<&str>, system_locale: &str) -> String;
pub fn translate(locale: &str, key: &str, params: &[(&str, &str)]) -> String;

impl AppState {
    pub fn new(store: SettingsStore) -> Self;
    pub fn new_with_system_state_provider(
        store: SettingsStore,
        system_locale: String,
        provider: Box<dyn SystemStateProvider>,
    ) -> Self;
    pub fn effective_locale(&self) -> String;
    pub fn i18n_state(&self) -> I18nState;
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct I18nState {
    pub language: Option<String>,
    pub effective_locale: String,
}
```

- `resolve_locale(Some(value), _)` 先按 canonical locale 或 alias 匹配；匹配失败返回 `en-US`。
- `resolve_locale(None, system)` 按系统语言 canonical locale 或 alias 匹配；匹配失败返回 `en-US`。
- locale 与 alias 匹配时忽略 ASCII 大小写，并把 `_` 规范化为 `-`。
- `translate()` 只替换调用方提供的 `{name}`；未知占位符保留原样。
- 若 key 在当前 locale 缺失，则从 `en-US` 取同一 key；若基准也没有，返回 key 原文。
- `AppState` 必须保存启动时解析到的 `system_locale`，不得在每个 tick 重新读取系统语言。

## 资源与文案契约

资源文件使用以下 schema；所有 messages 叶子必须是字符串，或只含 `one` / `other` 两个字符串的对象。

```json
{
  "locale": "zh-CN",
  "name": "简体中文",
  "aliases": ["zh", "zh-Hans", "zh-Hans-CN"],
  "messages": {
    "settings": {
      "title": "设置"
    },
    "tray": {
      "nextBreakMinutes": {
        "one": "距离下次休息还有 {count} 分钟",
        "other": "距离下次休息还有 {count} 分钟"
      }
    }
  }
}
```

`en-US` 的 `aliases` 为 `["en"]`。语言列表按 locale 字典序排序，显示 `name` 时不得翻译。

### 公共与设置文案

| Key                                     | en-US                                                                | zh-CN                                    |
| --------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| `common.minutes`                        | `minutes`                                                            | `分钟`                                   |
| `common.seconds`                        | `seconds`                                                            | `秒`                                     |
| `common.minutesShort`                   | `min`                                                                | `分`                                     |
| `common.secondsShort`                   | `sec`                                                                | `秒`                                     |
| `common.noLimit`                        | `No limit`                                                           | `不限`                                   |
| `common.reset`                          | `Reset`                                                              | `重置`                                   |
| `common.apply`                          | `Apply`                                                              | `应用`                                   |
| `common.to`                             | `to`                                                                 | `至`                                     |
| `common.followSystem`                   | `Follow system`                                                      | `跟随系统`                               |
| `common.duration.lessThanMinute`        | `<1m`                                                                | `<1分钟`                                 |
| `common.duration.minutes`               | `one: 1m; other: {count}m`                                           | `one: 1分钟; other: {count}分钟`         |
| `common.duration.hours`                 | `one: 1h; other: {count}h`                                           | `one: 1小时; other: {count}小时`         |
| `common.duration.hoursMinutesCompact`   | `{hours}h{minutes}m`                                                 | `{hours}小时{minutes}分钟`               |
| `common.duration.hoursMinutesSpaced`    | `{hours}h {minutes}m`                                                | `{hours}小时 {minutes}分钟`              |
| `settings.title`                        | `Settings`                                                           | `设置`                                   |
| `settings.save`                         | `Save`                                                               | `保存`                                   |
| `settings.loading`                      | `Loading settings`                                                   | `正在加载设置`                           |
| `settings.sectionsLabel`                | `Settings sections`                                                  | `设置分区`                               |
| `settings.tabs.general`                 | `General`                                                            | `常规`                                   |
| `settings.tabs.workingHours`            | `Working Hours`                                                      | `工作时段`                               |
| `settings.tabs.customization`           | `Customization`                                                      | `自定义`                                 |
| `settings.tabs.system`                  | `System`                                                             | `系统`                                   |
| `settings.breaks.title`                 | `Breaks`                                                             | `休息`                                   |
| `settings.breaks.toggle`                | `Breaks enabled`                                                     | `启用休息`                               |
| `settings.breaks.type`                  | `Break type`                                                         | `休息类型`                               |
| `settings.breaks.typePopup`             | `Popup break`                                                        | `弹窗休息`                               |
| `settings.breaks.typeNotification`      | `Notification`                                                       | `通知`                                   |
| `settings.breaks.frequency`             | `Frequency`                                                          | `频率`                                   |
| `settings.breaks.frequencyMinutesLabel` | `Break frequency in minutes`                                         | `休息频率（分钟）`                       |
| `settings.breaks.frequencySecondsLabel` | `Break frequency in seconds`                                         | `休息频率（秒）`                         |
| `settings.breaks.length`                | `Length`                                                             | `时长`                                   |
| `settings.breaks.lengthMinutesLabel`    | `Break length in minutes`                                            | `休息时长（分钟）`                       |
| `settings.breaks.lengthSecondsLabel`    | `Break length in seconds`                                            | `休息时长（秒）`                         |
| `settings.breaks.titleLabel`            | `Title`                                                              | `标题`                                   |
| `settings.breaks.messageLabel`          | `Message`                                                            | `消息`                                   |
| `settings.breaks.messagePlaceholder`    | `Enter your break message...`                                        | `输入休息消息…`                          |
| `settings.smartBreaks.title`            | `Smart Breaks`                                                       | `智能休息`                               |
| `settings.smartBreaks.idleReset`        | `Reset the break timer when idle`                                    | `空闲时重置休息计时器`                   |
| `settings.smartBreaks.minimumIdleTime`  | `Minimum idle time`                                                  | `最短空闲时间`                           |
| `settings.smartBreaks.minutesLabel`     | `Idle time in minutes`                                               | `空闲时间（分钟）`                       |
| `settings.smartBreaks.secondsLabel`     | `Idle time in seconds`                                               | `空闲时间（秒）`                         |
| `settings.smartBreaks.notification`     | `Show notification when break automatically detected`                | `自动检测到休息时显示通知`               |
| `settings.snooze.title`                 | `Snooze`                                                             | `稍后提醒`                               |
| `settings.snooze.helper`                | `Snoozing allows you to postpone breaks when busy.`                  | `忙碌时可暂时推迟休息。`                 |
| `settings.snooze.toggle`                | `Snooze enabled`                                                     | `启用稍后提醒`                           |
| `settings.snooze.length`                | `Length`                                                             | `时长`                                   |
| `settings.snooze.minutesLabel`          | `Snooze length in minutes`                                           | `稍后提醒时长（分钟）`                   |
| `settings.snooze.secondsLabel`          | `Snooze length in seconds`                                           | `稍后提醒时长（秒）`                     |
| `settings.snooze.limit`                 | `Limit`                                                              | `次数上限`                               |
| `settings.skip.title`                   | `Skip`                                                               | `跳过`                                   |
| `settings.skip.helper`                  | `Allow skipping breaks entirely without rescheduling them.`          | `允许完全跳过休息，而不重新安排。`       |
| `settings.skip.toggle`                  | `Allow skipping breaks`                                              | `允许跳过休息`                           |
| `settings.advanced.title`               | `Advanced`                                                           | `高级`                                   |
| `settings.advanced.immediatelyStart`    | `Immediately start breaks`                                           | `立即开始休息`                           |
| `settings.advanced.endEarly`            | `Allow ending break early`                                           | `允许提前结束休息`                       |
| `settings.workingHours.title`           | `Working Hours`                                                      | `工作时段`                               |
| `settings.workingHours.toggle`          | `Restrict breaks to working hours`                                   | `仅在工作时段内休息`                     |
| `settings.workingHours.days.monday`     | `Monday`                                                             | `星期一`                                 |
| `settings.workingHours.days.tuesday`    | `Tuesday`                                                            | `星期二`                                 |
| `settings.workingHours.days.wednesday`  | `Wednesday`                                                          | `星期三`                                 |
| `settings.workingHours.days.thursday`   | `Thursday`                                                           | `星期四`                                 |
| `settings.workingHours.days.friday`     | `Friday`                                                             | `星期五`                                 |
| `settings.workingHours.days.saturday`   | `Saturday`                                                           | `星期六`                                 |
| `settings.workingHours.days.sunday`     | `Sunday`                                                             | `星期日`                                 |
| `settings.workingHours.startAria`       | `{day} start {range}`                                                | `{day}开始时间 {range}`                  |
| `settings.workingHours.endAria`         | `{day} end {range}`                                                  | `{day}结束时间 {range}`                  |
| `settings.workingHours.addRange`        | `Add {day} range`                                                    | `为{day}添加时间段`                      |
| `settings.workingHours.copyRanges`      | `Copy {day} ranges`                                                  | `复制{day}的时间段`                      |
| `settings.workingHours.copyRangesTo`    | `Copy ranges to:`                                                    | `复制时间段到：`                         |
| `settings.workingHours.removeRange`     | `Remove {day} range {range}`                                         | `删除{day}的第{range}个时间段`           |
| `settings.theme.title`                  | `Theme`                                                              | `主题`                                   |
| `settings.theme.primaryColor`           | `Primary color`                                                      | `主色`                                   |
| `settings.theme.textColor`              | `Text color`                                                         | `文字颜色`                               |
| `settings.audio.title`                  | `Audio`                                                              | `音频`                                   |
| `settings.audio.breakSound`             | `Break sound`                                                        | `休息声音`                               |
| `settings.audio.sounds.none`            | `None`                                                               | `无`                                     |
| `settings.audio.sounds.gong`            | `Gong`                                                               | `铜锣`                                   |
| `settings.audio.sounds.blip`            | `Blip`                                                               | `哔声`                                   |
| `settings.audio.sounds.bloop`           | `Bloop`                                                              | `低鸣`                                   |
| `settings.audio.sounds.ping`            | `Ping`                                                               | `叮声`                                   |
| `settings.audio.sounds.scifi`           | `Sci-fi`                                                             | `科幻音`                                 |
| `settings.audio.preview`                | `Preview break sound`                                                | `试听休息声音`                           |
| `settings.audio.volume`                 | `Break sound volume`                                                 | `休息声音音量`                           |
| `settings.backdrop.title`               | `Backdrop`                                                           | `背景遮罩`                               |
| `settings.backdrop.helper`              | `Show a colored overlay behind break windows to limit distractions.` | `在休息窗口后方显示彩色遮罩，减少干扰。` |
| `settings.backdrop.toggle`              | `Show backdrop`                                                      | `显示背景遮罩`                           |
| `settings.backdrop.opacity`             | `Backdrop opacity`                                                   | `遮罩不透明度`                           |
| `settings.language.title`               | `Language`                                                           | `语言`                                   |
| `settings.language.helper`              | `Choose the language used by BreakTimer-new.`                        | `选择 BreakTimer-new 的显示语言。`       |
| `settings.language.label`               | `Display language`                                                   | `显示语言`                               |
| `settings.startup.title`                | `Start at login`                                                     | `登录时启动`                             |
| `settings.startup.helper`               | `Automatically start BreakTimer-new when you log in.`                | `登录时自动启动 BreakTimer-new。`        |
| `settings.startup.toggle`               | `Launch at login`                                                    | `登录时启动`                             |

### 休息、通知、托盘与 About 文案

| Key                            | en-US                                                               | zh-CN                                      |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| `break.loading`                | `Loading break`                                                     | `正在加载休息`                             |
| `break.startingIn`             | `Break starting in {seconds}s...`                                   | `休息将在 {seconds} 秒后开始…`             |
| `break.start`                  | `Start`                                                             | `开始`                                     |
| `break.snooze`                 | `Snooze`                                                            | `稍后提醒`                                 |
| `break.skip`                   | `Skip`                                                              | `跳过`                                     |
| `break.cancel`                 | `Cancel Break`                                                      | `取消休息`                                 |
| `break.defaultTitle`           | `Time for a break.`                                                 | `该休息了。`                               |
| `break.defaultMessage`         | `Rest your eyes.\nStretch your legs.\nBreathe. Relax.`              | `放松眼睛。\n伸展双腿。\n深呼吸，放松。`   |
| `break.timeSince`              | `{duration} since last break`                                       | `距上次休息 {duration}`                    |
| `notification.idleTitle`       | `Break automatically detected`                                      | `已自动检测到休息`                         |
| `notification.idleBody`        | `Away for {duration}`                                               | `已离开 {duration}`                        |
| `tray.enable`                  | `Enable`                                                            | `启用休息`                                 |
| `tray.disable`                 | `Disable...`                                                        | `禁用休息…`                                |
| `tray.indefinitely`            | `Indefinitely`                                                      | `无限期`                                   |
| `tray.minutes30`               | `30 minutes`                                                        | `30 分钟`                                  |
| `tray.hour1`                   | `1 hour`                                                            | `1 小时`                                   |
| `tray.hours2`                  | `2 hours`                                                           | `2 小时`                                   |
| `tray.hours4`                  | `4 hours`                                                           | `4 小时`                                   |
| `tray.restOfDay`               | `Rest of day`                                                       | `今天剩余时间`                             |
| `tray.startBreakNow`           | `Start break now`                                                   | `立即休息`                                 |
| `tray.settings`                | `Settings...`                                                       | `设置…`                                    |
| `tray.about`                   | `About...`                                                          | `关于…`                                    |
| `tray.quit`                    | `Quit`                                                              | `退出`                                     |
| `tray.nextBreakLessThanMinute` | `Next break in less than a minute`                                  | `距离下次休息不到 1 分钟`                  |
| `tray.nextBreakMinutes`        | `one: Next break in 1 minute; other: Next break in {count} minutes` | `one/other: 距离下次休息还有 {count} 分钟` |
| `tray.breaksDisabled`          | `Breaks disabled`                                                   | `休息已禁用`                               |
| `tray.outsideWorkingHours`     | `Outside of working hours`                                          | `非工作时段`                               |
| `tray.idle`                    | `Idle`                                                              | `空闲`                                     |
| `tray.disabledFor`             | `Disabled for {duration}`                                           | `已禁用 {duration}`                        |
| `about.title`                  | `About`                                                             | `关于`                                     |
| `about.build`                  | `Build`                                                             | `构建版本`                                 |
| `about.projectSource`          | `Project Source`                                                    | `项目源码`                                 |
| `about.upstream`               | `Upstream BreakTimer`                                               | `上游 BreakTimer`                          |
| `about.license`                | `Distributed under GPL-3.0-or-later license.`                       | `依据 GPL-3.0-or-later 许可证分发。`       |

### 默认休息文案识别

- React 与 Rust 都必须用 `translate("en-US", "break.defaultTitle")` 和
  `translate("en-US", "break.defaultMessage")` 判断旧内置值，不得再复制一份英文常量。
- 精确等于基准值：显示当前 locale 的 `break.defaultTitle` / `break.defaultMessage`。
- 不完全相等：原样显示用户值。`Time for a break`（无句号）必须保持自定义文本。
- Notification 模式仍先对内建或自定义消息执行现有 HTML strip，再发送通知。

---

## Task 1：共享资源与 React 纯翻译层

**Files:**

- Modify: `app/locales/en-US.json`
- Modify: `app/locales/zh-CN.json`
- Modify: `app/src/lib/i18n.tsx`
- Modify: `app/src/lib/i18n.test.ts`

**Interfaces:**

- Consumes: `import.meta.glob("../../locales/*.json", { query: "?raw", import: "default", eager: true })`
- Produces: `Language`、`MessageParams`、`Translate`、`availableLanguages()`、`translate(locale, key, params?)`
- Produces for tests: `createCatalog(rawResources: unknown[])`，返回
  `{ languages(): Language[]; translate(...): string; messageKeys(locale): string[] }`
- Produces for tests: `parseLocaleResource(raw: unknown)`；损坏或 schema 不合法时返回 `null`

- [x] **Step 1: 写失败测试**

```ts
it("falls back to en-US for an unknown locale", () => {
  expect(translate("fr-FR", "settings.title")).toBe("Settings");
});

it("falls back to en-US for a missing key and returns the key if both are missing", () => {
  const catalog = createCatalog([
    JSON.stringify({
      locale: "en-US",
      name: "English",
      aliases: ["en"],
      messages: { settings: { title: "Settings" } },
    }),
    JSON.stringify({
      locale: "zh-CN",
      name: "简体中文",
      aliases: ["zh"],
      messages: {},
    }),
  ]);

  expect(catalog.translate("zh-CN", "settings.title")).toBe("Settings");
  expect(catalog.translate("en-US", "missing.key")).toBe("missing.key");
});

it("interpolates values and selects plural variants", () => {
  const catalog = createCatalog([
    JSON.stringify({
      locale: "en-US",
      name: "English",
      aliases: ["en"],
      messages: {
        demo: {
          hello: "Hello, {name}!",
          items: { one: "{count} item", other: "{count} items" },
        },
      },
    }),
  ]);

  expect(catalog.translate("en-US", "demo.hello", { name: "Ada" })).toBe(
    "Hello, Ada!",
  );
  expect(catalog.translate("en-US", "demo.items", { count: 1 })).toBe("1 item");
  expect(catalog.translate("en-US", "demo.items", { count: 0 })).toBe(
    "0 items",
  );
  expect(catalog.translate("en-US", "demo.items", { count: -1 })).toBe(
    "-1 items",
  );
});

it("skips malformed locale resources", () => {
  expect(parseLocaleResource("{")).toBeNull();
  expect(
    parseLocaleResource(
      JSON.stringify({
        locale: "bad",
        name: "Bad",
        aliases: [],
        messages: { invalid: { one: "only one" } },
      }),
    ),
  ).toBeNull();
});

it("keeps the first-party locale key sets complete", () => {
  expect(messageKeys("zh-CN")).toEqual(messageKeys("en-US"));
});
```

- [x] **Step 2: 运行测试确认 RED**

Run: `pnpm exec vitest run src/lib/i18n.test.ts`

Expected: FAIL，因为 `createCatalog`、插值、回退和复数尚未实现。

- [x] **Step 3: 写完整资源与最小实现**

按本计划“资源与文案契约”补全两个 JSON。纯翻译层必须：

- 将嵌套 messages 展平为点分 key。
- 字符串叶子支持任意 `{name}` 替换。
- plural 叶子用 `Number(params.count) === 1` 选择 `one`，其他值选择 `other`。
- 当前 locale 未找到时查 `en-US`；基准也没有时返回 key。
- `availableLanguages()` 只返回解析成功的资源，按 locale 排序。
- 任一 schema 叶子非法时跳过整个资源。
- `translate("zh-CN", ...)` 不返回英文资源数组对象本身。

- [x] **Step 4: 运行聚焦测试确认 GREEN**

Run: `pnpm exec vitest run src/lib/i18n.test.ts`

Expected: PASS，至少覆盖资源发现、回退、插值、复数、损坏资源和中英文 key 完整性。

- [x] **Step 5: 类型检查**

Run: `pnpm typecheck`

Expected: PASS。

## Task 2：Rust 共享资源翻译层

**Files:**

- Modify: `app/src-tauri/Cargo.toml`
- Create: `app/src-tauri/src/i18n/mod.rs`
- Modify: `app/src-tauri/src/lib.rs`

**Interfaces:**

- Consumes: `include_dir!("$CARGO_MANIFEST_DIR/../locales")`
- Produces: `system_locale()`、`resolve_locale()`、`translate()`、`I18nState`
- Produces for tests: `Catalog::from_sources(&[&str])` 与
  `Catalog::{languages, translate, message_keys}`

- [x] **Step 1: 写失败测试**

```rust
#[test]
fn resolves_exact_locale_aliases_and_fallbacks() {
    assert_eq!(resolve_locale(Some("zh-Hans"), "en-US"), "zh-CN");
    assert_eq!(resolve_locale(Some("zh_CN"), "en-US"), "zh-CN");
    assert_eq!(resolve_locale(Some("fr-FR"), "zh-CN"), "en-US");
    assert_eq!(resolve_locale(None, "zh-CN"), "zh-CN");
    assert_eq!(resolve_locale(None, "fr-FR"), "en-US");
}

#[test]
fn translates_interpolates_plurals_and_falls_back() {
    let catalog = Catalog::from_sources(&[
        r#"{"locale":"en-US","name":"English","aliases":["en"],"messages":{"demo":{"hello":"Hello, {name}!","items":{"one":"{count} item","other":"{count} items"}},"settings":{"title":"Settings"}}}"#,
        r#"{"locale":"zh-CN","name":"简体中文","aliases":["zh"],"messages":{}}"#,
    ]);

    assert_eq!(translate("zh-CN", "settings.title", &[]), "设置");
    assert_eq!(catalog.translate("zh-CN", "settings.title", &[]), "Settings");
    assert_eq!(
        catalog.translate("en-US", "demo.hello", &[("name", "Ada")]),
        "Hello, Ada!"
    );
    assert_eq!(
        catalog.translate("en-US", "demo.items", &[("count", "1")]),
        "1 item"
    );
    assert_eq!(
        catalog.translate("en-US", "demo.items", &[("count", "-1")]),
        "-1 items"
    );
    assert_eq!(catalog.translate("en-US", "missing.key", &[]), "missing.key");
}

#[test]
fn skips_malformed_resources() {
    let catalog = Catalog::from_sources(&[
        r#"{"locale":"bad","name":"Bad","aliases":[],"messages":{"x":{"one":"x"}}}"#,
    ]);
    assert!(catalog.languages().is_empty());
}
```

- [x] **Step 2: 运行测试确认 RED**

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml i18n`

Expected: FAIL，因为模块、依赖与接口不存在。

- [x] **Step 3: 增加依赖并实现 catalog**

在 `Cargo.toml` 增加：

```toml
include_dir = "0.7"
sys-locale = "0.3"
```

实现与 TypeScript 相同的展平、alias、插值、plural、缺失 key 和损坏资源语义。`system_locale()` 只在真实启动时调用 `sys_locale::get_locale()`；找不到时返回 `en-US`。

- [x] **Step 4: 运行聚焦测试确认 GREEN**

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml i18n`

Expected: PASS。

- [x] **Step 5: 锁定依赖并检查**

Run: `cargo check --locked --all-targets --manifest-path app/src-tauri/Cargo.toml`

Expected: PASS，`Cargo.lock` 已更新。

## Task 3：设置字段、有效 locale 与 React Provider

**Files:**

- Modify: `app/src/types/settings.ts`
- Create: `app/src/types/i18n.ts`
- Modify: `app/src/lib/ipc.ts`
- Modify: `app/src/lib/i18n.tsx`
- Modify: `app/src/main.tsx`
- Modify: `app/index.html`
- Modify: `app/src-tauri/src/state/settings.rs`
- Modify: `app/src-tauri/src/state/mod.rs`
- Modify: `app/src-tauri/src/commands.rs`
- Modify: `app/src-tauri/src/lib.rs`
- Test: `app/src/lib/i18n.test.ts`
- Test: `app/src-tauri/src/state/settings.rs`
- Test: `app/src-tauri/src/state/mod.rs`
- Test: `app/src-tauri/src/commands.rs`

**Interfaces:**

- Consumes: Task 1 / Task 2 的 catalog。
- Produces: `Settings.language: string | null` / `Option<String>`。
- Produces: `AppState::effective_locale()`、`AppState::i18n_state()`。
- Produces: command `get_i18n_state`，返回 camelCase `I18nState`。
- Produces: `I18nProvider`、`useI18n()`、`ipc.getI18nState()`、`ipc.onLocaleChanged()`。

- [x] **Step 1: 写设置与状态测试**

```rust
#[test]
fn missing_language_defaults_to_follow_system() {
    let settings: Settings = serde_json::from_str("{}").unwrap();
    assert_eq!(settings.language, None);
    assert_eq!(
        serde_json::to_value(settings).unwrap()["language"],
        serde_json::Value::Null
    );
}

#[test]
fn effective_locale_uses_preference_then_system_locale() {
    let store = temp_store("locale-state.json");
    let state = AppState::new_with_system_state_provider(
        store,
        "zh-CN".to_string(),
        Box::new(FakeSystemStateProvider::new(vec![SystemActivity::Active])),
    );
    assert_eq!(state.i18n_state().effective_locale, "zh-CN");

    let settings = Settings {
        language: Some("en-US".to_string()),
        ..Settings::default()
    };
    state.store.set_settings(settings).unwrap();
    assert_eq!(state.i18n_state().effective_locale, "en-US");

    let settings = Settings {
        language: Some("fr-FR".to_string()),
        ..Settings::default()
    };
    state.store.set_settings(settings).unwrap();
    assert_eq!(state.i18n_state().effective_locale, "en-US");
}

#[test]
fn i18n_state_serializes_for_the_renderer() {
    let value = serde_json::to_value(I18nState {
        language: None,
        effective_locale: "zh-CN".to_string(),
    })
    .unwrap();
    assert_eq!(value["language"], serde_json::Value::Null);
    assert_eq!(value["effectiveLocale"], "zh-CN");
}
```

- [x] **Step 2: 写 Provider 失败测试**

```tsx
it("loads the effective locale, updates document.lang and reacts to events", async () => {
  let emit: ((state: I18nState) => void) | undefined;
  const client: I18nClient = {
    getI18nState: vi.fn().mockResolvedValue({
      language: null,
      effectiveLocale: "zh-CN",
    }),
    onLocaleChanged: vi.fn().mockImplementation(async (handler) => {
      emit = handler;
      return () => {};
    }),
  };

  render(
    <I18nProvider client={client}>
      <Probe />
    </I18nProvider>,
  );

  expect(await screen.findByText("设置")).toBeTruthy();
  expect(document.documentElement.lang).toBe("zh-CN");

  act(() => emit?.({ language: "en-US", effectiveLocale: "en-US" }));
  expect(await screen.findByText("Settings")).toBeTruthy();
  expect(document.documentElement.lang).toBe("en-US");
});
```

- [x] **Step 3: 运行测试确认 RED**

Run: `pnpm exec vitest run src/lib/i18n.test.ts`

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml state`

Expected: 两边都 FAIL，因为字段、Provider、状态与 command 尚不存在。

- [x] **Step 4: 实现设置、状态、IPC 与 Provider**

- Rust `Settings` 增加 `#[serde(default)] pub language: Option<String>`，不提升 settings 版本，不新增 migration。
- `AppState` 构造器接收固定的 `system_locale`；生产启动只调用一次 `i18n::system_locale()`。
- `AppState::effective_locale()` 不得锁 scheduler；`i18n_state()` 从当前 settings 派生。
- `get_i18n_state` 返回 `state.i18n_state()`。
- TypeScript `Settings` 增加 `language: string | null`；所有测试 fixture 显式补 `language: null`。
- `ipc.ts` 增加 `LOCALE_CHANGED_EVENT = "locale-changed"`、`getI18nState`、`onLocaleChanged`。
- `index.html` 的初始 `lang` 改为 `en-US`。
- `main.tsx` 用 `<I18nProvider><App /></I18nProvider>` 包住应用。
- Provider 在失败时保持英文，不阻塞页面；卸载时调用 unlisten。

- [x] **Step 5: 运行聚焦测试确认 GREEN**

Run: `pnpm exec vitest run src/lib/i18n.test.ts`

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml state`

Expected: PASS。

## Task 4：设置页与 Language 卡片

**Files:**

- Create: `app/src/components/settings/language-card.tsx`
- Modify: `app/src/components/settings/settings-window.tsx`
- Modify: `app/src/components/settings/breaks-card.tsx`
- Modify: `app/src/components/settings/smart-breaks-card.tsx`
- Modify: `app/src/components/settings/snooze-card.tsx`
- Modify: `app/src/components/settings/skip-card.tsx`
- Modify: `app/src/components/settings/advanced-card.tsx`
- Modify: `app/src/components/settings/working-hours-card.tsx`
- Modify: `app/src/components/settings/working-hours.ts`
- Modify: `app/src/components/settings/theme-card.tsx`
- Modify: `app/src/components/settings/audio-card.tsx`
- Modify: `app/src/components/settings/backdrop-card.tsx`
- Modify: `app/src/components/settings/startup-card.tsx`
- Test: `app/src/components/settings/settings-window.test.tsx`

**Interfaces:**

- Consumes: `useI18n()`、`availableLanguages()`、`Settings.language`。
- Produces: `LanguageCard({ settings, onPatch })`。
- Produces: `System` 页签顺序 `Language -> Start at login`。

- [x] **Step 1: 写失败测试**

```tsx
it("shows Language above Start at login and saves the drafted locale", async () => {
  const client = makeClient(makeSettings({ language: null }));
  const setSettings = vi.mocked(client.setSettings);

  render(<SettingsWindow client={client} />);
  await openSettingsTab("System");

  const cardTitles = Array.from(
    document.querySelectorAll<HTMLElement>('[data-slot="card-title"]'),
  ).map((element) => element.textContent);
  expect(cardTitles).toEqual(["Language", "Start at login"]);
  expect(screen.getByRole("option", { name: "English" })).toBeTruthy();
  expect(screen.getByRole("option", { name: "简体中文" })).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Display language"), {
    target: { value: "zh-CN" },
  });
  expect(screen.getByText("Settings")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ language: "zh-CN" }),
    ),
  );
});

it("renders the settings surface in Simplified Chinese", async () => {
  const client = makeClient(makeSettings({ language: "zh-CN" }));
  const localeClient = makeLocaleClient("zh-CN");

  render(
    <I18nProvider initialLocale="zh-CN" client={localeClient}>
      <SettingsWindow client={client} />
    </I18nProvider>,
  );

  expect(await screen.findByRole("tab", { name: "常规" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "设置" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "保存" })).toBeTruthy();
  expect(screen.getByText("启用休息")).toBeTruthy();
});
```

- [x] **Step 2: 运行测试确认 RED**

Run: `pnpm exec vitest run src/components/settings/settings-window.test.tsx`

Expected: FAIL，因为 Language 卡片和中英文文案尚未接入。

- [x] **Step 3: 替换设置页硬编码文案**

- `SETTINGS_TABS` 只保留稳定 `value`，label 在渲染时由 `t()` 生成。
- 所有 Card 标题、Label、helper、placeholder、Select option、按钮、ARIA 与隐藏 loading 文案改用本计划 key。
- `working-hours.ts` 的 `WorkingHoursDay.label` 改为 `labelKey`；`DayRow` 通过 `t(labelKey)` 生成可见标签和 ARIA。
- `DurationInputs` 保留现有 structure、尺寸、原生输入类型与两位秒数行为，只翻译 `min` / `sec` 和 aria label。
- `SOUND_OPTIONS` 的 value 保持 `SoundType` 不变，label 改为 key。
- `data-settings-group` 继续使用当前翻译后的 Card 标题；英文测试仍应得到原英文值。
- `LanguageCard` 使用 `SettingsCard`，Select 值 `settings.language ?? ""`，空字符串映射回 `null`。
- `System` 页签顺序固定为 `<LanguageCard />`、`<StartupCard />`。
- 保存仍只走 `SettingsWindow` 既有全量 draft + `client.setSettings(draft)`，不得在选择语言时调用后端。

- [x] **Step 4: 运行设置页测试确认 GREEN**

Run: `pnpm exec vitest run src/components/settings/settings-window.test.tsx`

Expected: PASS，原有英文断言保持通过。

- [x] **Step 5: 检查中文布局**

Run: `pnpm test`

Expected: PASS。运行态检查在 Task 8 的 L15 执行。

## Task 5：休息页与默认文案

**Files:**

- Modify: `app/src/components/break/break-window.tsx`
- Modify: `app/src/components/break/utils.ts`
- Test: `app/src/components/break/break-window.test.tsx`

**Interfaces:**

- Consumes: `useI18n()` 与 Task 1 的 `break.*` keys。
- Produces: `localizedBreakText(value, key, locale)`。
- Produces: `formatTimeSinceLastBreak(seconds, translate)`。

- [x] **Step 1: 写失败测试**

```ts
it("localizes only the exact legacy default break text", () => {
  expect(
    localizedBreakText("Time for a break.", "break.defaultTitle", "zh-CN"),
  ).toBe("该休息了。");
  expect(
    localizedBreakText("Time for a break", "break.defaultTitle", "zh-CN"),
  ).toBe("Time for a break");
  expect(
    localizedBreakText(
      "Rest your eyes.\nStretch your legs.\nBreathe. Relax.",
      "break.defaultMessage",
      "zh-CN",
    ),
  ).toBe("放松眼睛。\n伸展双腿。\n深呼吸，放松。");
});
```

组件测试至少要覆盖：

- 中文 Provider 下 loading、开始倒计时、Start、Snooze、Skip、Cancel Break 使用中文。
- 默认标题与消息显示中文。
- 自定义标题、消息和 HTML 逐字保留。
- 现有英文测试和按钮行为不变。

- [x] **Step 2: 运行测试确认 RED**

Run: `pnpm exec vitest run src/components/break/break-window.test.tsx`

Expected: FAIL，因为休息页仍硬编码英文。

- [x] **Step 3: 实现休息页翻译**

- 在 `break-window.tsx` 中使用 `const { t, locale } = useI18n()`。
- `settings.breakTitle` / `settings.breakMessage` 通过 `localizedBreakText()` 得到显示值。
- `formatTimeSinceLastBreak()` 使用 `common.duration.*` 与 `break.timeSince`，不得写语言分支。
- React 文本继续通过 JSX 插值渲染；不得使用 `dangerouslySetInnerHTML`，用户 HTML 保持字面内容。
- 自定义值不 trim、不 split、不改换行。

- [x] **Step 4: 运行休息页测试确认 GREEN**

Run: `pnpm exec vitest run src/components/break/break-window.test.tsx`

Expected: PASS。

## Task 6：托盘与 About

**Files:**

- Modify: `app/src-tauri/src/state/mod.rs`
- Modify: `app/src-tauri/src/tray/mod.rs`
- Test: `app/src-tauri/src/tray/mod.rs`

**Interfaces:**

- Consumes: `AppState::effective_locale()` 与 Rust `translate()`。
- Produces: `TraySnapshot.locale: String`。
- Produces: `build_tray_snapshot(..., locale: &str)`。
- Produces: `about_content(version, locale)`。

- [x] **Step 1: 写失败测试**

```rust
#[test]
fn formats_tray_labels_in_simplified_chinese() {
    assert_eq!(format_compact_duration(90 * 60, "zh-CN"), "1小时30分钟");
    assert_eq!(
        format_next_break_label(61, "zh-CN"),
        "距离下次休息还有 1 分钟"
    );
    assert_eq!(
        format_next_break_label(28 * 60, "zh-CN"),
        "距离下次休息还有 28 分钟"
    );
}

#[test]
fn locale_change_invalidates_snapshot_without_changing_layout() {
    let (scheduler, settings) = running_scheduler();
    let english = snapshot(
        &scheduler,
        &settings,
        at(30),
        true,
        SystemActivity::Active,
        None,
        "en-US",
    );
    let chinese = snapshot(
        &scheduler,
        &settings,
        at(30),
        true,
        SystemActivity::Active,
        None,
        "zh-CN",
    );

    assert_ne!(english, chinese);
    assert_eq!(english.locale, "en-US");
    assert_eq!(chinese.locale, "zh-CN");
    assert_eq!(
        TrayMenuLayout::from_snapshot(&english),
        TrayMenuLayout::from_snapshot(&chinese)
    );
}
```

- [x] **Step 2: 运行测试确认 RED**

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml tray`

Expected: FAIL，因为快照与格式化函数尚无 locale。

- [x] **Step 3: 原地更新所有菜单文本**

- `TraySnapshot` 增加 `locale`，保证语言变化能被快照相等性检测到。
- `TrayMenuHandles` 增加 `settings`、`about`、`quit` 句柄；初始创建时使用 locale 文案。
- `apply_snapshot()` 在 locale 变化时对所有固定项调用 `set_text`，包括 Enable、Disable 子菜单及子项、Start break now、Settings、About、Quit。
- 不替换根 `Menu`，不重新绑定 tray icon；保持 ADR-0010。
- `status_label`、`disabled_label`、macOS title 使用同一 locale。
- `format_compact_duration(seconds, locale)` 使用 `common.duration.*`。
- `about_content(version, locale)` 只翻译标签与许可证句子，产品名、版本、URL 和许可证标识保持原样；dialog title 使用 `about.title`。

- [x] **Step 4: 运行托盘测试确认 GREEN**

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml tray`

Expected: PASS，英文快照断言保持通过。

## Task 7：通知、locale 广播与保存链路

**Files:**

- Modify: `app/src-tauri/src/state/settings.rs`
- Modify: `app/src-tauri/src/flow.rs`
- Modify: `app/src-tauri/src/commands.rs`
- Test: `app/src-tauri/src/flow.rs`
- Test: `app/src-tauri/src/commands.rs`

**Interfaces:**

- Consumes: `AppState::i18n_state()`、Rust `translate()`。
- Produces: `LOCALE_CHANGED_EVENT = "locale-changed"`。
- Produces: 保存前后有效 locale 比较；只在 `effectiveLocale` 变化时广播。

- [x] **Step 1: 写失败测试**

```rust
#[test]
fn idle_reset_body_uses_the_current_locale() {
    assert_eq!(idle_reset_body(3_661, "en-US"), "Away for 01:01:01");
    assert_eq!(idle_reset_body(3_661, "zh-CN"), "已离开 01:01:01");
}

#[test]
fn default_break_message_follows_locale_but_custom_text_is_unchanged() {
    let default_message = Settings::default().break_message;
    assert_eq!(
        notification_body(&default_message, "zh-CN"),
        "放松眼睛。\n伸展双腿。\n深呼吸，放松。"
    );
    assert_eq!(
        notification_body("Look <b>away</b>.<br>Stretch.", "zh-CN"),
        "Look away. Stretch."
    );
}
```

- [x] **Step 2: 运行测试确认 RED**

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml flow`

Expected: FAIL，因为通知文案仍为英文常量。

- [x] **Step 3: 实现通知与广播**

- 删除 `IDLE_RESET_NOTIFICATION_TITLE` / `BREAK_NOTIFICATION_TITLE` 的业务含义，改为在触发时按有效 locale 翻译。
- `notify_idle_reset()`、`notify_break()` 都在真正触发通知时读取当前 `effective_locale`。
- Notification 标题使用 `settings.breakTitle`：旧版英文默认值按当前 locale 翻译，自定义值剥离 HTML 后原样显示。
- `notification_body()` 先按 `en-US.break.defaultMessage` 精确判断内建默认值并翻译，否则 strip_html 原用户文本。
- `set_settings()` 在写 store 前记录 `previous = state.i18n_state()`；应用 settings effects 与托盘刷新后读取 `next`。
- 若 `previous.effective_locale != next.effective_locale`，广播 `locale-changed` 和 `next`。
- 已显示的系统通知不得尝试更新或撤回。
- 广播 payload 使用 camelCase `I18nState`。

- [x] **Step 4: 运行聚焦测试确认 GREEN**

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml flow`

Run: `cargo test --manifest-path app/src-tauri/Cargo.toml commands`

Expected: PASS。

## Task 8：跨运行时集成、第三语言验证与人工验收

**Files:**

- Test: `app/src/lib/i18n.test.ts`
- Test: `app/src-tauri/src/i18n/mod.rs`
- Modify after acceptance: `docs/specs/0014-multilingual-support.md`
- Modify after acceptance: `docs/plans/0003-multilingual-support.md`
- Modify after acceptance: `docs/specs/README.md`
- Modify after acceptance: `docs/roadmap.md`
- Create after acceptance: `.ai/sessions/YYYY-MM-DD-multilingual-support.md`
- Modify after acceptance: `.ai/memory.md`

- [x] **Step 1: 增加第三语言纯 catalog 测试**

TypeScript 与 Rust 各用一个合成 `fr-FR` 资源验证：

```ts
const catalog = createCatalog([
  JSON.stringify({
    locale: "fr-FR",
    name: "Français",
    aliases: ["fr"],
    messages: { settings: { title: "Paramètres" } },
  }),
]);

expect(catalog.languages()).toContainEqual({
  locale: "fr-FR",
  name: "Français",
});
expect(catalog.translate("fr-FR", "settings.title")).toBe("Paramètres");
```

该测试证明页面和后端不需要 locale enum 或逐语言注册代码。

- [x] **Step 2: 做一次临时真实第三语言构建验证**

1. 复制 `app/locales/zh-CN.json` 为 `app/locales/fr-FR.json`。
2. 将临时文件的 `locale` 改为 `fr-FR`、`name` 改为 `Français`、`aliases` 改为 `["fr"]`。
3. 运行 `pnpm build` 与 `cargo check --locked --all-targets --manifest-path app/src-tauri/Cargo.toml`。
4. 启动开发版，确认 `System` 页签语言列表出现 `Français`，React 与 Rust 均能解析该资源。
5. 删除临时 `app/locales/fr-FR.json`，再次运行 `pnpm build`。

Expected: 两次 build 均通过，源码最终不保留 `fr-FR` 资源。

- [x] **Step 3: 执行完整自动化门禁**

在 `app/`：

```powershell
pnpm test
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
```

在仓库根目录：

```powershell
cargo test --all-targets --manifest-path app/src-tauri/Cargo.toml
cargo check --locked --all-targets --manifest-path app/src-tauri/Cargo.toml
cargo fmt --all --manifest-path app/src-tauri/Cargo.toml -- --check
git diff --check
```

Expected: 全部 PASS。记录前端与 Rust 的最终测试数量。

- [x] **Step 4: Windows 人工验收**

先备份设置文件，启动开发版，按以下步骤执行：

1. **L1**：准备全新设置并将 Windows 显示语言设为中文，启动后确认设置页为中文；将系统语言改为英文或不受支持语言后重启，确认回退英文。测试后恢复系统语言与设置。
2. **L2**：打开 `System`，确认 `Language` 位于 `Start at login` 上方，选项含 `Follow system`、`English`、`简体中文`。
3. **L3**：选择另一语言但不保存，确认当前界面不变；点击 `Save` 后确认设置页立即切换。
4. **L4**：重启应用确认手动语言保留；选择 `Follow system` 保存并确认设置文件写入 `language: null`，重启后跟随系统。
5. **L5**：从备份中移除 `language` 字段，启动后确认正常且等同 `null`。
6. **L6**：中文下逐页检查设置页、休息前提示、休息页、托盘、About、系统通知、ARIA 与屏幕阅读器文案。
7. **L7**：切回英文检查无中文残留；语言原生名中的 `简体中文` 除外。
8. **L8**：切换语言后通过开发者工具确认 `<html lang="zh-CN">` / `<html lang="en-US">`。
9. **L9**：在休息页已打开时从设置页切换语言，确认已打开休息页与托盘立即更新，不重建托盘根菜单。
10. **L10**：切到中文后触发 Notification 模式通知，确认下一次通知为中文，旧通知未被改写。
11. **L11**：分别验证默认标题/消息随语言切换；输入 `Time for a break`（无句号）、自定义中文、英文和含 HTML 的内容，确认逐字保留。
12. **L12**：用托盘 1 分钟/多分钟状态与 `Disabled for` 验证插值和 `0/1/2/-1` 复数规则。
13. **L13**：临时破坏非基准 locale JSON，确认应用仍启动并回退英文；恢复文件。
14. **L14**：按 Step 2 临时增加第三语言，确认选择与 React/Rust 解析均可用；删除临时文件。
15. **L15**：检查窗口 960×720、当前最小尺寸和托盘菜单，确认中英文标签、按钮、菜单、休息页无截断或重叠。

测试结束后从备份恢复用户设置，确认设置文件哈希与测试前一致，关闭开发进程与调试端口。不要执行打包命令。

- [x] **Step 5: 等待用户人工确认**

汇报每项 L1-L15 的结果、自动化测试数量、已知限制和未验证项。只有用户明确回复“验收通过”后，才进入文档收口。

- [x] **Step 6: 验收通过后收口文档**

- SPEC-0014 所有 L1-L15 勾选，状态改为 `done`，补变更记录。
- PLAN-0003 所有步骤勾选，状态改为 `done`，补验证记录。
- `docs/specs/README.md` 与 `docs/roadmap.md` 同步完成状态。
- 写 `.ai/sessions/YYYY-MM-DD-multilingual-support.md`，更新 `.ai/memory.md`。
- 按用户提交指令执行 Git 提交与推送；未收到提交指令不得自行提交。

## 风险与边界

- 简单 `one` / `other` 不能表达 Russian、Arabic 等复杂 CLDR 复数类别；出现需求时另立 ADR。
- React 与 Rust 是两个解析器，必须用同一组边界测试防止插值/复数语义漂移。
- 初始化 Provider 前可能短暂显示英文；本期接受，不引入阻塞式启动页。
- 未知 stored `language` 视为不支持并显示英文；本次不为未知值增加额外的 UI 状态。
- 中文标签可能改变设置行宽度，L15 必须实际检查；必要时只调整现有布局，不新增卡片层级或缩放字体。

## 验证记录

- 2026-10-23：Task 1-7 已实现；验收反馈修复后前端测试 54 个、Rust 测试 107 个通过。
- 2026-10-23：`pnpm lint`、`pnpm typecheck`、`pnpm format:check`、`pnpm build` 与
  `cargo check --locked --all-targets` 通过。
- 2026-10-23：临时加入 `fr-FR` 时前后端构建通过，删除后再次构建通过，源码无临时语言文件残留。
- 2026-10-23：L1-L15 Windows 人工验收待执行。
- 2026-10-23：人工验收反馈修复已通过聚焦测试：通知标题使用 `breakTitle`、Snooze 同列基线对齐、中文短单位改为“分”；等待复验。
- 2026-10-23：用户确认三项修复复验通过；L1-L15 人工验收全部完成。

## 变更记录

| 日期       | 变更                                                               |
| ---------- | ------------------------------------------------------------------ |
| 2026-10-23 | 创建并确认实施计划；当轮只完成文档，不进入代码实现                 |
| 2026-10-23 | Task 1-7 与自动化门禁完成，状态改为 `in-progress`；等待人工验收 |
| 2026-10-23 | 修复验收反馈三项，聚焦回归测试通过；等待复验 |
| 2026-10-23 | 三项修复复验通过；文档收口，状态改为 `done` |
