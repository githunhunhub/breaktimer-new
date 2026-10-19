//! Break flow orchestration (SPEC-0002, SPEC-0003, SPEC-0009).
//!
//! The scheduler in [`crate::breaks`] is pure state; this module is the seam
//! that turns its transitions into visible effects: per-monitor windows, sound
//! playback and renderer broadcasts. Every entry point (background tick and
//! user commands) goes through here so the behavior stays identical.

use chrono::Utc;
use tauri::{AppHandle, Emitter, Runtime};

use crate::breaks::{BreakActionError, BreakEndOutcome, BreakStart, BreakTick};
use crate::notifications;
use crate::sounds;
use crate::state::AppState;
use crate::state::settings::NotificationType;
use crate::tray;
use crate::windows;

/// Renderer event carrying the latest [`crate::breaks::BreakStatus`] snapshot.
pub const BREAK_STATUS_EVENT: &str = "break-status";

/// Title of the optional idle-reset notification (SPEC-0005).
pub const IDLE_RESET_NOTIFICATION_TITLE: &str = "Break automatically detected";

/// Title of the break reminder shown in Notification mode (SPEC-0008).
pub const BREAK_NOTIFICATION_TITLE: &str = "Time for a break!";

/// Advances the scheduler by one tick and applies the resulting side effects.
pub fn tick<R: Runtime>(app: &AppHandle<R>, state: &AppState) {
    let now = Utc::now();

    // A timed disable from the tray ends like a manual re-enable (SPEC-0006).
    if state.expire_timed_disable(now) {
        emit_status(app, state);
    }

    match state.tick(now) {
        // Without a transition the tray countdown still advances, so the menu
        // is refreshed on every tick (SPEC-0006, ADR-0006).
        BreakTick::None => tray::refresh(app),
        BreakTick::IdleReset(reset) => {
            if reset.notify {
                notify_idle_reset(app, reset.idle_seconds);
            }
            emit_status(app, state);
        }
        BreakTick::BreakPrompted => {
            if is_notification_mode(state) {
                notify_break(app, state);
            } else {
                let settings = state.store.settings();
                if let Err(error) = windows::show_prompt(app, &settings) {
                    eprintln!("failed to show break prompt: {error}");
                }
                emit_status(app, state);
            }
        }
        BreakTick::BreakStarted(start) => break_started(app, state, &start),
        BreakTick::BreakEnded(_) => break_ended(app, state),
    }
}

/// Starts the prompted break (SPEC-0002 "Start").
pub fn begin_break<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<BreakStart, BreakActionError> {
    let (start, started_tracking) = state.begin_break_transition(Utc::now())?;

    if started_tracking {
        break_started(app, state, &start);
    } else {
        // Multiple overlay windows can race the same "Start" command. Only the
        // transition into a tracked break may resize windows or play sound.
        emit_status(app, state);
    }

    Ok(start)
}

/// Starts a break immediately, bypassing the prompt (SPEC-0003).
pub fn start_break_now<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> BreakStart {
    let start = state.start_break_now(Utc::now());

    if is_notification_mode(state) {
        notify_break(app, state);
        return start;
    }

    break_started(app, state, &start);
    start
}

/// Ends the active break and reschedules (SPEC-0003).
pub fn end_break<R: Runtime>(app: &AppHandle<R>, state: &AppState) -> BreakEndOutcome {
    let (outcome, ended_break) = state.end_break_transition(Utc::now());

    if ended_break {
        break_ended(app, state);
    }

    outcome
}

/// Postpones the active break (SPEC-0003).
pub fn postpone_break<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<(), BreakActionError> {
    state.postpone_break(Utc::now())?;
    windows::close_all(app);
    emit_status(app, state);
    Ok(())
}

/// Skips the active break (SPEC-0003).
pub fn skip_break<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<(), BreakActionError> {
    state.skip_break(Utc::now())?;
    windows::close_all(app);
    emit_status(app, state);
    Ok(())
}

fn break_started<R: Runtime>(app: &AppHandle<R>, state: &AppState, _start: &BreakStart) {
    let settings = state.store.settings();

    if settings.notification_type == NotificationType::Notification {
        notify_break(app, state);
        return;
    }

    if let Err(error) = windows::show_break(app) {
        eprintln!("failed to show break window: {error}");
    }
    sounds::play(&settings, true);
    emit_status(app, state);
}

fn break_ended<R: Runtime>(app: &AppHandle<R>, state: &AppState) {
    let settings = state.store.settings();
    sounds::play(&settings, false);
    windows::close_all(app);
    emit_status(app, state);
}

fn notify_idle_reset<R: Runtime>(app: &AppHandle<R>, idle_seconds: u64) {
    let body = idle_reset_body(idle_seconds);
    if let Err(error) = notifications::notify(app, IDLE_RESET_NOTIFICATION_TITLE, &body) {
        eprintln!("failed to show idle reset notification: {error}");
    }
}

fn is_notification_mode(state: &AppState) -> bool {
    state.store.settings().notification_type == NotificationType::Notification
}

/// Shows the Notification-mode reminder, plays the optional start sound and
/// immediately completes the break so the next one is scheduled (SPEC-0008).
///
/// Deliberately never touches [`windows`]: this mode must not open an overlay.
fn notify_break<R: Runtime>(app: &AppHandle<R>, state: &AppState) {
    let settings = state.store.settings();
    let body = notification_body(&settings.break_message);

    if let Err(error) = notifications::notify(app, BREAK_NOTIFICATION_TITLE, &body) {
        eprintln!("failed to show break notification: {error}");
    }
    sounds::play(&settings, true);

    state.complete_notification_break(Utc::now());
    emit_status(app, state);
}

/// Plain-text notification body for Notification mode (SPEC-0008).
fn notification_body(break_message: &str) -> String {
    notifications::strip_html(break_message)
}

/// Formats the idle duration as the legacy `Away for HH:MM:SS` body (SPEC-0005).
fn idle_reset_body(idle_seconds: u64) -> String {
    let hours = idle_seconds / 3600;
    let minutes = (idle_seconds % 3600) / 60;
    let seconds = idle_seconds % 60;
    format!("Away for {hours:02}:{minutes:02}:{seconds:02}")
}

/// Broadcasts the current scheduler snapshot to every window.
pub fn emit_status<R: Runtime>(app: &AppHandle<R>, state: &AppState) {
    let status = state.break_status(Utc::now());
    if let Err(error) = app.emit(BREAK_STATUS_EVENT, status) {
        eprintln!("failed to emit break status: {error}");
    }
    // Every scheduler change is also a tray change (SPEC-0006).
    tray::refresh(app);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idle_reset_body_formats_the_away_duration() {
        assert_eq!(idle_reset_body(0), "Away for 00:00:00");
        assert_eq!(idle_reset_body(59), "Away for 00:00:59");
        assert_eq!(idle_reset_body(60), "Away for 00:01:00");
        assert_eq!(idle_reset_body(3_661), "Away for 01:01:01");
        assert_eq!(idle_reset_body(360_000), "Away for 100:00:00");
    }

    #[test]
    fn notification_body_is_plain_text() {
        assert_eq!(
            notification_body("Rest <b>your</b> eyes.<br>Stretch."),
            "Rest your eyes. Stretch."
        );
    }
}
