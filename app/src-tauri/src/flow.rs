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
use crate::windows;

/// Renderer event carrying the latest [`crate::breaks::BreakStatus`] snapshot.
pub const BREAK_STATUS_EVENT: &str = "break-status";

/// Title of the optional idle-reset notification (SPEC-0005).
pub const IDLE_RESET_NOTIFICATION_TITLE: &str = "Break automatically detected";

/// Advances the scheduler by one tick and applies the resulting side effects.
pub fn tick<R: Runtime>(app: &AppHandle<R>, state: &AppState) {
    match state.tick(Utc::now()) {
        BreakTick::None => {}
        BreakTick::IdleReset(reset) => {
            if reset.notify {
                notify_idle_reset(app, reset.idle_seconds);
            }
            emit_status(app, state);
        }
        BreakTick::BreakPrompted => {
            let settings = state.store.settings();
            if let Err(error) = windows::show_prompt(app, &settings) {
                eprintln!("failed to show break prompt: {error}");
            }
            emit_status(app, state);
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
    if let Err(error) = windows::show_break(app, &settings) {
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
}
