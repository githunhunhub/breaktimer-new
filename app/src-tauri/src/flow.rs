//! Break flow orchestration (SPEC-0002, SPEC-0003, SPEC-0009).
//!
//! The scheduler in [`crate::breaks`] is pure state; this module is the seam
//! that turns its transitions into visible effects: per-monitor windows, sound
//! playback and renderer broadcasts. Every entry point (background tick and
//! user commands) goes through here so the behavior stays identical.

use chrono::Utc;
use tauri::{AppHandle, Emitter, Runtime};

use crate::breaks::{BreakActionError, BreakEndOutcome, BreakStart, BreakTick};
use crate::sounds;
use crate::state::AppState;
use crate::windows;

/// Renderer event carrying the latest [`crate::breaks::BreakStatus`] snapshot.
pub const BREAK_STATUS_EVENT: &str = "break-status";

/// Advances the scheduler by one tick and applies the resulting side effects.
pub fn tick<R: Runtime>(app: &AppHandle<R>, state: &AppState) {
    match state.tick(Utc::now()) {
        BreakTick::None => {}
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

/// Broadcasts the current scheduler snapshot to every window.
pub fn emit_status<R: Runtime>(app: &AppHandle<R>, state: &AppState) {
    let status = state.break_status(Utc::now());
    if let Err(error) = app.emit(BREAK_STATUS_EVENT, status) {
        eprintln!("failed to emit break status: {error}");
    }
}
