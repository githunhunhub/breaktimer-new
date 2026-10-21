//! System tray (SPEC-0006).
//!
//! Tauri/muda only exposes whole-menu replacement, so the menu is rebuilt from
//! a [`TraySnapshot`] whenever that snapshot changes (ADR-0006). The snapshot
//! derivation itself is pure so every state and label is unit-testable without
//! a running application.

use std::sync::Mutex;

use chrono::{DateTime, Local, Timelike, Utc};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Runtime};

use crate::breaks::{BreakPhase, BreakScheduler, SystemActivity};
use crate::error::AppResult;
use crate::flow;
use crate::state::{AppState, Settings, SettingsEffects, TrayTextMode};
use crate::windows;

const TRAY_ID: &str = "main";

const STATUS_MENU_ID: &str = "status";
const DISABLED_MENU_ID: &str = "disabled-for";
const ENABLE_MENU_ID: &str = "enable";
const DISABLE_MENU_ID: &str = "disable";
const DISABLE_INDEFINITELY_MENU_ID: &str = "disable-indefinitely";
const DISABLE_30_MINUTES_MENU_ID: &str = "disable-30-minutes";
const DISABLE_1_HOUR_MENU_ID: &str = "disable-1-hour";
const DISABLE_2_HOURS_MENU_ID: &str = "disable-2-hours";
const DISABLE_4_HOURS_MENU_ID: &str = "disable-4-hours";
const DISABLE_REST_OF_DAY_MENU_ID: &str = "disable-rest-of-day";
const START_BREAK_MENU_ID: &str = "start-break";
const SETTINGS_MENU_ID: &str = "settings";
const ABOUT_MENU_ID: &str = "about";
const QUIT_MENU_ID: &str = "quit";

/// Which mutually exclusive tray state is currently showing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayState {
    Working,
    /// Breaks are turned off, optionally until `disable_end_time`.
    Disabled,
    OutsideWorkingHours,
    Idle,
    OnBreak,
}

/// Everything the tray menu and macOS title render, detached from Tauri so the
/// label rules can be tested directly.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TraySnapshot {
    pub state: TrayState,
    /// Countdown line shown while working.
    pub status_label: Option<String>,
    /// `Disabled for …` line while a timed disable is running.
    pub disabled_label: Option<String>,
    /// macOS-only menu bar title; `None` clears it.
    pub title: Option<String>,
    pub show_enable: bool,
    pub show_disable: bool,
    pub show_start_break: bool,
}

/// Last menu snapshot applied to the tray icon, used to skip redundant rebuilds.
pub struct TrayStateStore {
    last_snapshot: Option<TraySnapshot>,
}

/// Creates the tray icon with its initial menu (SPEC-0006).
pub fn init<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    let icon = Image::from_bytes(include_bytes!("../../icons/32x32.png"))?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("BreakTimer")
        .show_menu_on_left_click(true)
        .on_menu_event(handle_menu_event)
        .build(app)?;

    app.manage(Mutex::new(TrayStateStore {
        last_snapshot: None,
    }));
    Ok(())
}

/// Rebuilds the tray menu when [`AppState::tray_snapshot`] changed (SPEC-0006).
///
/// The lock only guards the snapshot comparison and update. The tray calls stay
/// outside it because `TrayIcon::set_menu`/`set_title` marshal onto the main
/// thread and block until it runs the task, while menu events run on that same
/// thread and refresh the tray themselves.
pub fn refresh<R: Runtime>(app: &AppHandle<R>) {
    let snapshot = app.state::<AppState>().tray_snapshot(Utc::now());

    {
        let tray_state = app.state::<Mutex<TrayStateStore>>();
        let tray = tray_state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if tray.last_snapshot.as_ref() == Some(&snapshot) {
            return;
        }
    }

    let Some(icon) = app.tray_by_id(TRAY_ID) else {
        eprintln!("tray icon is not registered");
        return;
    };

    let menu = match build_menu(app, &snapshot) {
        Ok(menu) => menu,
        Err(error) => {
            eprintln!("failed to build tray menu: {error}");
            return;
        }
    };
    if let Err(error) = icon.set_menu(Some(menu)) {
        eprintln!("failed to update tray menu: {error}");
        return;
    }

    // Unsupported on Windows and Linux panels without title support, where the
    // call is a no-op (SPEC-0006 macOS title).
    if let Err(error) = icon.set_title(snapshot.title.as_deref()) {
        eprintln!("failed to update tray title: {error}");
    }

    let tray_state = app.state::<Mutex<TrayStateStore>>();
    let mut tray = tray_state
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    tray.last_snapshot = Some(snapshot);
}

fn build_menu<R: Runtime>(app: &AppHandle<R>, snapshot: &TraySnapshot) -> AppResult<Menu<R>> {
    let status = match snapshot.status_label.as_deref() {
        Some(label) => Some(MenuItem::with_id(
            app,
            STATUS_MENU_ID,
            label,
            false,
            None::<&str>,
        )?),
        None => None,
    };
    let enable = MenuItem::with_id(app, ENABLE_MENU_ID, "Enable", true, None::<&str>)?;
    let disable_indefinitely = MenuItem::with_id(
        app,
        DISABLE_INDEFINITELY_MENU_ID,
        "Indefinitely",
        true,
        None::<&str>,
    )?;
    let disable_30_minutes = MenuItem::with_id(
        app,
        DISABLE_30_MINUTES_MENU_ID,
        "30 minutes",
        true,
        None::<&str>,
    )?;
    let disable_1_hour =
        MenuItem::with_id(app, DISABLE_1_HOUR_MENU_ID, "1 hour", true, None::<&str>)?;
    let disable_2_hours =
        MenuItem::with_id(app, DISABLE_2_HOURS_MENU_ID, "2 hours", true, None::<&str>)?;
    let disable_4_hours =
        MenuItem::with_id(app, DISABLE_4_HOURS_MENU_ID, "4 hours", true, None::<&str>)?;
    let disable_rest_of_day = MenuItem::with_id(
        app,
        DISABLE_REST_OF_DAY_MENU_ID,
        "Rest of day",
        true,
        None::<&str>,
    )?;
    let disable = Submenu::with_id_and_items(
        app,
        DISABLE_MENU_ID,
        "Disable...",
        true,
        &[
            &disable_indefinitely,
            &disable_30_minutes,
            &disable_1_hour,
            &disable_2_hours,
            &disable_4_hours,
            &disable_rest_of_day,
        ],
    )?;
    let start_break = MenuItem::with_id(
        app,
        START_BREAK_MENU_ID,
        "Start break now",
        true,
        None::<&str>,
    )?;
    let settings = MenuItem::with_id(app, SETTINGS_MENU_ID, "Settings...", true, None::<&str>)?;
    let about = MenuItem::with_id(app, ABOUT_MENU_ID, "About...", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_MENU_ID, "Quit", true, None::<&str>)?;

    let top_separator = PredefinedMenuItem::separator(app)?;
    let bottom_separator = PredefinedMenuItem::separator(app)?;

    let mut items: Vec<&dyn tauri::menu::IsMenuItem<R>> = Vec::new();
    if let Some(status) = &status {
        items.push(status);
    }
    let disabled = disabled_label_item(app, snapshot)?;
    if let Some(disabled) = &disabled {
        items.push(disabled);
    }
    if !items.is_empty() {
        items.push(&top_separator);
    }
    if snapshot.show_enable {
        items.push(&enable);
    }
    if snapshot.show_disable {
        items.push(&disable);
    }
    if snapshot.show_start_break {
        items.push(&start_break);
    }
    if snapshot.show_enable || snapshot.show_disable || snapshot.show_start_break {
        items.push(&bottom_separator);
    }
    items.push(&settings);
    items.push(&about);
    items.push(&quit);

    Ok(Menu::with_items(app, &items)?)
}

/// The `Disabled for …` line is a disabled menu item, like the legacy tray.
fn disabled_label_item<R: Runtime>(
    app: &AppHandle<R>,
    snapshot: &TraySnapshot,
) -> AppResult<Option<MenuItem<R>>> {
    match snapshot.disabled_label.as_deref() {
        Some(label) => Ok(Some(MenuItem::with_id(
            app,
            DISABLED_MENU_ID,
            label,
            false,
            None::<&str>,
        )?)),
        None => Ok(None),
    }
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    let state = app.state::<AppState>();

    match event.id().as_ref() {
        ENABLE_MENU_ID => set_breaks_enabled(app, &state, true),
        DISABLE_INDEFINITELY_MENU_ID => disable_breaks(app, &state, None),
        DISABLE_30_MINUTES_MENU_ID => disable_breaks(app, &state, Some(30 * 60)),
        DISABLE_1_HOUR_MENU_ID => disable_breaks(app, &state, Some(60 * 60)),
        DISABLE_2_HOURS_MENU_ID => disable_breaks(app, &state, Some(2 * 60 * 60)),
        DISABLE_4_HOURS_MENU_ID => disable_breaks(app, &state, Some(4 * 60 * 60)),
        DISABLE_REST_OF_DAY_MENU_ID => {
            disable_breaks(app, &state, Some(seconds_until_end_of_day()))
        }
        START_BREAK_MENU_ID => {
            flow::start_break_now(app, &state);
        }
        SETTINGS_MENU_ID => show_settings_window(app),
        ABOUT_MENU_ID => show_about_window(app),
        QUIT_MENU_ID => app.exit(0),
        _ => {}
    }
}

/// Turns breaks on or off from the tray menu, applying the same side effects as
/// the settings window (SPEC-0006, SPEC-0010).
///
/// Disabling also closes an overlay that is already on screen; turning breaks
/// back on resets the countdown because `set_settings` clears a pending
/// `disableEndTime` (ADR-0006).
fn set_breaks_enabled<R: Runtime>(app: &AppHandle<R>, state: &AppState, enabled: bool) {
    let current = state.store.settings();
    if current.breaks_enabled == enabled {
        refresh(app);
        return;
    }

    if !enabled && state.break_status(Utc::now()).phase == BreakPhase::OnBreak {
        windows::close_all(app);
    }

    let next = Settings {
        breaks_enabled: enabled,
        ..current.clone()
    };
    if let Err(error) = state.store.set_settings(next.clone()) {
        eprintln!("failed to change the breaks state: {error}");
        return;
    }

    state.apply_settings_effects(&next, SettingsEffects::between(&current, &next), Utc::now());
    flow::emit_status(app, state);
}

/// Disables breaks, optionally until a deadline the 1 s tick enforces
/// (SPEC-0006).
fn disable_breaks<R: Runtime>(app: &AppHandle<R>, state: &AppState, seconds: Option<i64>) {
    set_breaks_enabled(app, state, false);

    // The disabled state is persisted first, so an interruption can only ever
    // leave breaks off instead of off-but-unscheduled.
    let end_time = seconds.map(|seconds| Utc::now().timestamp() + seconds.max(1));
    if let Err(error) = state.store.set_disable_end_time(end_time) {
        eprintln!("failed to persist the disable end time: {error}");
    }

    refresh(app);
}

/// Seconds from now until 23:59:59 local time (SPEC-0006 "Rest of day").
fn seconds_until_end_of_day() -> i64 {
    let now = Local::now();
    let seconds_today =
        i64::from(now.hour()) * 3600 + i64::from(now.minute()) * 60 + i64::from(now.second());
    (86_400 - 1 - seconds_today).max(1)
}

fn show_settings_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.show() {
            eprintln!("failed to show settings window: {error}");
        }
        if let Err(error) = window.set_focus() {
            eprintln!("failed to focus settings window: {error}");
        }
    }
}

/// About dialog (SPEC-0006), parented to the settings window when it exists.
///
/// Mirrors the legacy message box, including the build/website/source lines.
fn show_about_window<R: Runtime>(app: &AppHandle<R>) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

    let version = app.package_info().version.to_string();
    let content = format!(
        "BreakTimer\n\nBuild: {version}\n\nWebsite:\nhttps://breaktimer.app\n\n\
         Source Code:\nhttps://github.com/tom-james-watson/breaktimer-app\n\n\
         Distributed under GPL-3.0-or-later license."
    );
    let mut builder = app
        .dialog()
        .message(content)
        .title("About")
        .kind(MessageDialogKind::Info);

    let parent = app.get_webview_window("main");
    if let Some(window) = &parent {
        builder = builder.parent(window);
    }
    builder.show(|_| {});
}

/// Derives the tray view of the scheduler (SPEC-0006).
pub fn build_tray_snapshot(
    scheduler: &BreakScheduler,
    settings: &Settings,
    now: DateTime<Utc>,
    in_working_hours: bool,
    activity: SystemActivity,
    disable_end_time: Option<i64>,
) -> TraySnapshot {
    let phase = scheduler.phase();
    let next_break_at = scheduler.next_break_at();
    let time_since_last_break = now
        .signed_duration_since(scheduler.last_completed_break_at())
        .num_seconds()
        .max(0);

    let idle = settings.idle_reset_enabled
        && matches!(
            activity,
            SystemActivity::Idle { idle_seconds }
                if idle_seconds >= u64::from(settings.idle_reset_length_seconds.max(1))
        );

    let state = if !settings.breaks_enabled {
        TrayState::Disabled
    } else if !in_working_hours {
        TrayState::OutsideWorkingHours
    } else if idle {
        TrayState::Idle
    } else if phase == BreakPhase::OnBreak {
        TrayState::OnBreak
    } else {
        TrayState::Working
    };

    // The countdown label only makes sense while the scheduler is working.
    let next_break_label = if state == TrayState::Working {
        next_break_at.map(|next_break_at| {
            let remaining = next_break_at
                .signed_duration_since(now)
                .num_seconds()
                .max(0);
            format_next_break_label(remaining)
        })
    } else {
        None
    };

    let disabled_label = if state == TrayState::Disabled {
        disable_end_time.map(|end_time| {
            format!(
                "Disabled for {}",
                format_compact_duration(end_time.saturating_sub(now.timestamp()))
            )
        })
    } else {
        None
    };

    let status_label = match (state, &disabled_label) {
        (TrayState::Disabled, Some(_)) => None,
        (TrayState::Disabled, None) => Some("Breaks disabled".to_string()),
        (TrayState::OutsideWorkingHours, _) => Some("Outside of working hours".to_string()),
        (TrayState::Idle, _) => Some("Idle".to_string()),
        _ => next_break_label.clone(),
    };

    let title = if settings.tray_text_enabled && state == TrayState::Working {
        match settings.tray_text_mode {
            TrayTextMode::TimeToNextBreak => next_break_at.map(|next_break_at| {
                let remaining = next_break_at
                    .signed_duration_since(now)
                    .num_seconds()
                    .max(0);
                format!(" {}", format_compact_duration(remaining))
            }),
            TrayTextMode::TimeSinceLastBreak => Some(format!(
                " {}",
                format_compact_duration(time_since_last_break)
            )),
        }
    } else {
        None
    };

    TraySnapshot {
        state,
        status_label,
        disabled_label,
        title,
        show_enable: state == TrayState::Disabled,
        show_disable: state != TrayState::Disabled,
        show_start_break: state != TrayState::OnBreak,
    }
}

fn format_next_break_label(seconds_remaining: i64) -> String {
    if seconds_remaining > 60 {
        let minutes = seconds_remaining / 60;
        if minutes == 1 {
            "Next break in 1 minute".to_string()
        } else {
            format!("Next break in {minutes} minutes")
        }
    } else {
        "Next break in less than a minute".to_string()
    }
}

/// Legacy compact duration: `<1m`, `28m`, `1h`, `1h30m` (SPEC-0006).
fn format_compact_duration(seconds: i64) -> String {
    if seconds < 60 {
        return "<1m".to_string();
    }

    let total_minutes = seconds / 60;
    let hours = total_minutes / 60;
    let minutes = total_minutes % 60;

    match (hours, minutes) {
        (0, minutes) => format!("{minutes}m"),
        (hours, 0) => format!("{hours}h"),
        (hours, minutes) => format!("{hours}h{minutes}m"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::breaks::{BreakScheduler, BreakTick, SchedulerContext};

    fn at(seconds: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_700_000_000 + seconds, 0).unwrap()
    }

    fn running_scheduler() -> (BreakScheduler, Settings) {
        let settings = Settings {
            break_frequency_seconds: 60,
            break_length_seconds: 120,
            ..Settings::default()
        };
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        (scheduler, settings)
    }

    fn snapshot(
        scheduler: &BreakScheduler,
        settings: &Settings,
        now: DateTime<Utc>,
        in_working_hours: bool,
        activity: SystemActivity,
        disable_end_time: Option<i64>,
    ) -> TraySnapshot {
        build_tray_snapshot(
            scheduler,
            settings,
            now,
            in_working_hours,
            activity,
            disable_end_time,
        )
    }

    #[test]
    fn compact_durations_follow_the_legacy_format() {
        assert_eq!(format_compact_duration(0), "<1m");
        assert_eq!(format_compact_duration(59), "<1m");
        assert_eq!(format_compact_duration(60), "1m");
        assert_eq!(format_compact_duration(28 * 60), "28m");
        assert_eq!(format_compact_duration(60 * 60), "1h");
        assert_eq!(format_compact_duration(90 * 60), "1h30m");
        assert_eq!(format_compact_duration(2 * 60 * 60 + 5 * 60), "2h5m");
    }

    #[test]
    fn next_break_labels_use_minutes() {
        assert_eq!(
            format_next_break_label(0),
            "Next break in less than a minute"
        );
        assert_eq!(
            format_next_break_label(60),
            "Next break in less than a minute"
        );
        assert_eq!(format_next_break_label(61), "Next break in 1 minute");
        assert_eq!(format_next_break_label(28 * 60), "Next break in 28 minutes");
    }

    #[test]
    fn working_state_shows_the_next_break_countdown() {
        let (scheduler, settings) = running_scheduler();

        let snapshot = snapshot(
            &scheduler,
            &settings,
            at(30),
            true,
            SystemActivity::Active,
            None,
        );

        assert_eq!(snapshot.state, TrayState::Working);
        assert_eq!(
            snapshot.status_label.as_deref(),
            Some("Next break in less than a minute")
        );
        assert!(snapshot.show_disable);
        assert!(snapshot.show_start_break);
        assert!(!snapshot.show_enable);
    }

    #[test]
    fn timed_disable_shows_the_remaining_duration() {
        let (scheduler, settings) = running_scheduler();
        let settings = Settings {
            breaks_enabled: false,
            ..settings
        };

        let snapshot = snapshot(
            &scheduler,
            &settings,
            at(0),
            true,
            SystemActivity::Active,
            Some(at(0).timestamp() + 90 * 60),
        );

        assert_eq!(snapshot.state, TrayState::Disabled);
        assert_eq!(
            snapshot.disabled_label.as_deref(),
            Some("Disabled for 1h30m")
        );
        assert_eq!(snapshot.status_label, None);
        assert!(snapshot.show_enable);
        assert!(!snapshot.show_disable);
    }

    #[test]
    fn indefinite_disable_has_no_countdown() {
        let (scheduler, settings) = running_scheduler();
        let settings = Settings {
            breaks_enabled: false,
            ..settings
        };

        let snapshot = snapshot(
            &scheduler,
            &settings,
            at(0),
            true,
            SystemActivity::Active,
            None,
        );

        assert_eq!(snapshot.status_label.as_deref(), Some("Breaks disabled"));
        assert_eq!(snapshot.disabled_label, None);
    }

    #[test]
    fn outside_working_hours_and_idle_replace_the_countdown() {
        let (scheduler, settings) = running_scheduler();

        let outside = snapshot(
            &scheduler,
            &settings,
            at(0),
            false,
            SystemActivity::Active,
            None,
        );
        assert_eq!(outside.state, TrayState::OutsideWorkingHours);
        assert_eq!(
            outside.status_label.as_deref(),
            Some("Outside of working hours")
        );

        let idle = snapshot(
            &scheduler,
            &settings,
            at(0),
            true,
            SystemActivity::Idle { idle_seconds: 600 },
            None,
        );
        assert_eq!(idle.state, TrayState::Idle);
        assert_eq!(idle.status_label.as_deref(), Some("Idle"));
    }

    #[test]
    fn idle_label_requires_the_configured_threshold() {
        let (scheduler, settings) = running_scheduler();
        let settings = Settings {
            idle_reset_length_seconds: 300,
            ..settings
        };

        let short_idle = snapshot(
            &scheduler,
            &settings,
            at(0),
            true,
            SystemActivity::Idle { idle_seconds: 299 },
            None,
        );

        assert_eq!(short_idle.state, TrayState::Working);
    }

    #[test]
    fn macos_title_follows_the_configured_mode() {
        let (scheduler, settings) = running_scheduler();
        let settings = Settings {
            tray_text_mode: TrayTextMode::TimeSinceLastBreak,
            ..settings
        };

        let snapshot = snapshot(
            &scheduler,
            &settings,
            at(90),
            true,
            SystemActivity::Active,
            None,
        );

        // `last_completed_break_at` starts at scheduler creation.
        assert_eq!(snapshot.title.as_deref(), Some(" 1m"));
    }

    #[test]
    fn title_is_cleared_while_a_break_is_on_screen() {
        let (mut scheduler, settings) = running_scheduler();
        assert_eq!(
            scheduler.tick(
                &settings,
                SchedulerContext {
                    now: at(60),
                    in_working_hours: true,
                    activity: SystemActivity::Active,
                },
            ),
            BreakTick::BreakPrompted
        );

        let snapshot = snapshot(
            &scheduler,
            &settings,
            at(60),
            true,
            SystemActivity::Active,
            None,
        );

        assert_eq!(snapshot.state, TrayState::OnBreak);
        assert_eq!(snapshot.title, None);
        assert!(!snapshot.show_start_break);
    }

    #[test]
    fn rest_of_day_is_positive_even_just_before_midnight() {
        assert!(seconds_until_end_of_day() >= 1);
    }

    #[test]
    fn timed_disable_falls_back_to_the_under_a_minute_label() {
        let (scheduler, settings) = running_scheduler();
        let settings = Settings {
            breaks_enabled: false,
            ..settings
        };

        let snapshot = snapshot(
            &scheduler,
            &settings,
            at(0),
            true,
            SystemActivity::Active,
            Some(at(0).timestamp() + 30),
        );

        assert_eq!(snapshot.disabled_label.as_deref(), Some("Disabled for <1m"));
    }
}
