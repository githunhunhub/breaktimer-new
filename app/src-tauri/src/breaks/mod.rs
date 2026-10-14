//! Break scheduler (SPEC-0003).
//!
//! Full state machine, working hours, idle reset and resume handling land in
//! M4 phases 2 and 3. What lives here now is the shared vocabulary the rest of
//! the backend will build on.

#![allow(dead_code)]

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;

use crate::state::Settings;

/// Where the scheduler currently is in the break cycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BreakPhase {
    /// No break is due and the countdown is not running (breaks disabled).
    Idle,
    /// Counting down to the next break.
    Working,
    /// A break is on screen.
    OnBreak,
    /// The user postponed; the postpone timer is running.
    Postponed,
}

/// Break scheduler state. The timer loop and condition checks are added in M4.
#[derive(Debug)]
pub struct BreakScheduler {
    phase: BreakPhase,
    last_completed_break_at: DateTime<Utc>,
    next_break_at: Option<DateTime<Utc>>,
}

impl BreakScheduler {
    pub fn new() -> Self {
        Self::new_at(Utc::now())
    }

    pub fn new_at(now: DateTime<Utc>) -> Self {
        Self {
            phase: BreakPhase::Idle,
            last_completed_break_at: now,
            next_break_at: None,
        }
    }

    pub fn phase(&self) -> BreakPhase {
        self.phase
    }

    #[allow(dead_code)]
    pub fn set_phase(&mut self, phase: BreakPhase) {
        self.phase = phase;
    }

    pub fn last_completed_break_at(&self) -> DateTime<Utc> {
        self.last_completed_break_at
    }

    pub fn next_break_at(&self) -> Option<DateTime<Utc>> {
        self.next_break_at
    }

    pub fn reset_time_since_last_break(&mut self, now: DateTime<Utc>) {
        self.last_completed_break_at = now;
    }

    pub fn restart(&mut self, settings: &Settings, now: DateTime<Utc>) {
        if settings.breaks_enabled {
            self.phase = BreakPhase::Working;
            self.next_break_at =
                Some(now + Duration::seconds(i64::from(settings.break_frequency_seconds)));
        } else {
            self.phase = BreakPhase::Idle;
            self.next_break_at = None;
        }
    }
}

impl Default for BreakScheduler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_idle() {
        assert_eq!(BreakScheduler::new().phase(), BreakPhase::Idle);
    }

    #[test]
    fn restart_schedules_the_next_break_when_enabled() {
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        let settings = Settings {
            break_frequency_seconds: 60,
            ..Settings::default()
        };
        let mut scheduler = BreakScheduler::new_at(now);

        scheduler.restart(&settings, now);

        assert_eq!(scheduler.phase(), BreakPhase::Working);
        assert_eq!(scheduler.next_break_at(), Some(now + Duration::seconds(60)));
    }

    #[test]
    fn restart_clears_the_next_break_when_disabled() {
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        let enabled = Settings::default();
        let disabled = Settings {
            breaks_enabled: false,
            ..enabled.clone()
        };
        let mut scheduler = BreakScheduler::new_at(now);
        scheduler.restart(&enabled, now);

        scheduler.restart(&disabled, now);

        assert_eq!(scheduler.phase(), BreakPhase::Idle);
        assert_eq!(scheduler.next_break_at(), None);
    }

    #[test]
    fn reset_updates_the_last_completed_break_time() {
        let started_at = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        let reset_at = started_at + Duration::seconds(30);
        let mut scheduler = BreakScheduler::new_at(started_at);

        scheduler.reset_time_since_last_break(reset_at);

        assert_eq!(scheduler.last_completed_break_at(), reset_at);
    }

    #[test]
    fn serializes_phase_for_the_frontend() {
        assert_eq!(
            serde_json::to_string(&BreakPhase::OnBreak).unwrap(),
            "\"ON_BREAK\""
        );
    }
}
