//! Break scheduler (SPEC-0003).
//!
//! Full state machine, working hours, idle reset and resume handling land in
//! M4 phases 2 and 3. What lives here now is the shared vocabulary the rest of
//! the backend will build on.

#![allow(dead_code)]

use serde::Serialize;

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
}

impl BreakScheduler {
    pub fn new() -> Self {
        Self {
            phase: BreakPhase::Idle,
        }
    }

    pub fn phase(&self) -> BreakPhase {
        self.phase
    }

    #[allow(dead_code)]
    pub fn set_phase(&mut self, phase: BreakPhase) {
        self.phase = phase;
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
    fn serializes_phase_for_the_frontend() {
        assert_eq!(
            serde_json::to_string(&BreakPhase::OnBreak).unwrap(),
            "\"ON_BREAK\""
        );
    }
}
