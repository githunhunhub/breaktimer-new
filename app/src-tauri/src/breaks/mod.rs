//! Break scheduler (SPEC-0003).
//!
//! Full state machine, working hours, idle reset and resume handling land in
//! M4 phases 2 and 3. What lives here now is the shared vocabulary the rest of
//! the backend will build on.

#![allow(dead_code)]

use chrono::{DateTime, Duration, Utc};
use serde::Serialize;

use crate::state::Settings;

fn seconds_or_one(seconds: u32) -> i64 {
    i64::from(seconds.max(1))
}

pub fn is_in_working_hours_at(
    settings: &Settings,
    weekday: chrono::Weekday,
    minutes_since_midnight: u32,
) -> bool {
    if !settings.working_hours_enabled {
        return true;
    }

    let today = match weekday {
        chrono::Weekday::Mon => &settings.working_hours_monday,
        chrono::Weekday::Tue => &settings.working_hours_tuesday,
        chrono::Weekday::Wed => &settings.working_hours_wednesday,
        chrono::Weekday::Thu => &settings.working_hours_thursday,
        chrono::Weekday::Fri => &settings.working_hours_friday,
        chrono::Weekday::Sat => &settings.working_hours_saturday,
        chrono::Weekday::Sun => &settings.working_hours_sunday,
    };

    today.enabled
        && today.ranges.iter().any(|range| {
            range.from_minutes <= minutes_since_midnight
                && minutes_since_midnight <= range.to_minutes
        })
}

/// Pre-break prompt timing (SPEC-0002).
///
/// The prompt first shows a grace period where the user can start early, then a
/// countdown; if the user does nothing the break starts on its own. The legacy
/// renderer used the same 60s + 60s split.
pub const PROMPT_GRACE_SECONDS: i64 = 60;
pub const PROMPT_COUNTDOWN_SECONDS: i64 = 60;
pub const PROMPT_TOTAL_SECONDS: i64 = PROMPT_GRACE_SECONDS + PROMPT_COUNTDOWN_SECONDS;

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

/// System activity reported by the platform-specific state provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SystemActivity {
    Active,
    Idle { idle_seconds: u64 },
    Locked { locked_seconds: u64 },
    Unavailable,
}

/// Inputs supplied to one pure scheduler tick (SPEC-0003, SPEC-0004, SPEC-0005).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SchedulerContext {
    pub now: DateTime<Utc>,
    pub in_working_hours: bool,
    pub activity: SystemActivity,
}

/// A state transition produced by a scheduler tick.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BreakTick {
    None,
    /// An idle period reset the countdown and may need a system notification.
    IdleReset(IdleReset),
    /// A break is due, but the user still has the pre-break prompt.
    BreakPrompted,
    /// The break countdown has started.
    BreakStarted(BreakStart),
    /// A tracked break reached its natural end.
    BreakEnded(BreakEndOutcome),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct IdleReset {
    pub idle_seconds: u64,
    pub notify: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BreakStart {
    pub end_at: DateTime<Utc>,
    pub started_from_tray: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BreakEndOutcome {
    pub completed: bool,
    pub duration_seconds: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum BreakActionError {
    #[error("no break is active")]
    NotOnBreak,
    #[error("the postpone limit has been reached")]
    PostponeLimitReached,
}

/// Frontend-facing snapshot of the scheduler.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakStatus {
    pub phase: BreakPhase,
    pub break_started_at: Option<i64>,
    pub break_end_at: Option<i64>,
    pub next_break_at: Option<i64>,
    /// When the pre-break prompt appeared (SPEC-0002), if it is still showing.
    pub prompt_started_at: Option<i64>,
    /// When the prompt auto-starts the break, if it is still showing.
    pub prompt_deadline_at: Option<i64>,
    pub time_since_last_break_seconds: i64,
    pub allow_postpone: bool,
    pub started_from_tray: bool,
}

/// Break scheduler state.
#[derive(Debug)]
pub struct BreakScheduler {
    phase: BreakPhase,
    last_completed_break_at: DateTime<Utc>,
    next_break_at: Option<DateTime<Utc>>,
    current_break_started_at: Option<DateTime<Utc>>,
    break_end_at: Option<DateTime<Utc>>,
    prompted_at: Option<DateTime<Utc>>,
    postponed_count: u32,
    started_from_tray: bool,
    last_tick_at: Option<DateTime<Utc>>,
    last_in_working_hours: Option<bool>,
    paused_until_active: bool,
    idle_reset_active: bool,
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
            current_break_started_at: None,
            break_end_at: None,
            prompted_at: None,
            postponed_count: 0,
            started_from_tray: false,
            last_tick_at: None,
            last_in_working_hours: None,
            paused_until_active: false,
            idle_reset_active: false,
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

    pub fn current_break_started_at(&self) -> Option<DateTime<Utc>> {
        self.current_break_started_at
    }

    pub fn break_end_at(&self) -> Option<DateTime<Utc>> {
        self.break_end_at
    }

    pub fn prompt_started_at(&self) -> Option<DateTime<Utc>> {
        self.prompted_at
    }

    pub fn prompt_deadline_at(&self) -> Option<DateTime<Utc>> {
        self.prompted_at
            .map(|started_at| started_at + Duration::seconds(PROMPT_TOTAL_SECONDS))
    }

    pub fn is_break_tracking(&self) -> bool {
        self.current_break_started_at.is_some() && self.break_end_at.is_some()
    }

    pub fn reset_time_since_last_break(&mut self, now: DateTime<Utc>) {
        self.last_completed_break_at = now;
    }

    fn clear_pending_break(&mut self) {
        self.phase = BreakPhase::Working;
        self.next_break_at = None;
    }

    fn schedule_next_break(&mut self, settings: &Settings, now: DateTime<Utc>) {
        self.phase = BreakPhase::Working;
        self.next_break_at =
            Some(now + Duration::seconds(seconds_or_one(settings.break_frequency_seconds)));
    }

    pub fn restart(&mut self, settings: &Settings, now: DateTime<Utc>) {
        // A settings save must not silently cancel the break currently on screen.
        if self.phase == BreakPhase::OnBreak {
            return;
        }

        self.current_break_started_at = None;
        self.break_end_at = None;
        self.prompted_at = None;
        self.postponed_count = 0;
        self.started_from_tray = false;
        self.last_tick_at = Some(now);
        self.last_in_working_hours = None;
        self.paused_until_active = false;
        self.idle_reset_active = false;

        if settings.breaks_enabled {
            self.schedule_next_break(settings, now);
        } else {
            self.phase = BreakPhase::Idle;
            self.next_break_at = None;
        }
    }

    pub fn tick(&mut self, settings: &Settings, context: SchedulerContext) -> BreakTick {
        let now = context.now;
        let elapsed_seconds = self
            .last_tick_at
            .map(|last_tick| now.signed_duration_since(last_tick).num_seconds().max(0))
            .unwrap_or(0);
        self.last_tick_at = Some(now);

        if self.phase == BreakPhase::OnBreak {
            if let Some(end_at) = self.break_end_at {
                if now >= end_at {
                    return BreakTick::BreakEnded(self.end_break(settings, now));
                }
            }
            // Prompt phase (no break tracking yet): auto-start once the prompt
            // window has fully elapsed (SPEC-0002).
            if self.current_break_started_at.is_none() {
                if let Some(deadline) = self.prompt_deadline_at() {
                    if now >= deadline {
                        return BreakTick::BreakStarted(
                            self.begin_break(settings, now)
                                .expect("a prompted break can always begin"),
                        );
                    }
                }
            }
            return BreakTick::None;
        }

        if !settings.breaks_enabled {
            self.phase = BreakPhase::Idle;
            self.next_break_at = None;
            self.paused_until_active = false;
            self.idle_reset_active = false;
            self.last_in_working_hours = Some(context.in_working_hours);
            return BreakTick::None;
        }

        let entered_working_hours =
            self.last_in_working_hours == Some(false) && context.in_working_hours;
        self.last_in_working_hours = Some(context.in_working_hours);
        let frequency_seconds = seconds_or_one(settings.break_frequency_seconds);

        if elapsed_seconds > frequency_seconds {
            self.clear_pending_break();
            self.last_completed_break_at = now;
            self.paused_until_active = false;
            self.idle_reset_active = false;
            self.postponed_count = 0;
            return BreakTick::None;
        }

        if let SystemActivity::Locked { .. } = context.activity {
            self.clear_pending_break();
            self.paused_until_active = true;
            self.idle_reset_active = false;
            return BreakTick::None;
        }

        if !context.in_working_hours {
            self.clear_pending_break();
            self.paused_until_active = true;
            self.idle_reset_active = false;
            return BreakTick::None;
        }

        if entered_working_hours {
            self.last_completed_break_at = now;
            self.paused_until_active = true;
        }

        if settings.idle_reset_enabled {
            if let SystemActivity::Idle { idle_seconds } = context.activity {
                let idle_reset_seconds = u64::from(settings.idle_reset_length_seconds.max(1));
                if idle_seconds >= idle_reset_seconds {
                    if self.idle_reset_active {
                        return BreakTick::None;
                    }

                    self.clear_pending_break();
                    self.last_completed_break_at = now;
                    self.paused_until_active = true;
                    self.idle_reset_active = true;
                    self.postponed_count = 0;
                    return BreakTick::IdleReset(IdleReset {
                        idle_seconds,
                        notify: settings.idle_reset_notification,
                    });
                }
            }
        }

        let should_resume =
            self.paused_until_active || self.idle_reset_active || self.next_break_at.is_none();
        self.paused_until_active = false;
        self.idle_reset_active = false;
        if should_resume {
            self.schedule_next_break(settings, now);
            return BreakTick::None;
        }

        let Some(next_break_at) = self.next_break_at else {
            unreachable!("a resumed schedule always has a next break");
        };

        if now < next_break_at {
            return BreakTick::None;
        }

        self.phase = BreakPhase::OnBreak;
        self.next_break_at = None;
        self.current_break_started_at = None;
        self.break_end_at = None;
        self.prompted_at = Some(now);
        self.started_from_tray = false;

        if settings.immediately_start_breaks {
            return BreakTick::BreakStarted(
                self.begin_break(settings, now)
                    .expect("a prompted break can always begin"),
            );
        }

        BreakTick::BreakPrompted
    }

    pub fn begin_break(
        &mut self,
        settings: &Settings,
        now: DateTime<Utc>,
    ) -> Result<BreakStart, BreakActionError> {
        if self.phase != BreakPhase::OnBreak {
            return Err(BreakActionError::NotOnBreak);
        }

        if let (Some(_), Some(end_at)) = (self.current_break_started_at, self.break_end_at) {
            return Ok(BreakStart {
                end_at,
                started_from_tray: self.started_from_tray,
            });
        }

        self.current_break_started_at = Some(now);
        self.break_end_at =
            Some(now + Duration::seconds(seconds_or_one(settings.break_length_seconds)));
        self.prompted_at = None;

        Ok(BreakStart {
            end_at: self.break_end_at.expect("break end was just set"),
            started_from_tray: self.started_from_tray,
        })
    }

    /// Starts a prompted break and reports whether this call created the
    /// tracked break. Multiple overlay windows may race the same command, but
    /// only the first transition should play sound or resize windows.
    pub fn begin_break_transition(
        &mut self,
        settings: &Settings,
        now: DateTime<Utc>,
    ) -> Result<(BreakStart, bool), BreakActionError> {
        if self.phase != BreakPhase::OnBreak {
            return Err(BreakActionError::NotOnBreak);
        }

        if self.is_break_tracking() {
            return Ok((
                BreakStart {
                    end_at: self.break_end_at.expect("tracked break has an end"),
                    started_from_tray: self.started_from_tray,
                },
                false,
            ));
        }

        self.begin_break(settings, now).map(|start| (start, true))
    }

    /// Completes a Notification-mode break immediately and schedules the next
    /// one (SPEC-0008).
    ///
    /// Notification mode never shows a break window, but the scheduler may
    /// already be prompted or auto-started when this transition runs.
    pub fn complete_notification_break(&mut self, settings: &Settings, now: DateTime<Utc>) {
        self.current_break_started_at = None;
        self.break_end_at = None;
        self.prompted_at = None;
        self.postponed_count = 0;
        self.started_from_tray = false;
        self.paused_until_active = false;
        self.idle_reset_active = false;
        self.last_completed_break_at = now;

        if settings.breaks_enabled {
            self.schedule_next_break(settings, now);
        } else {
            self.phase = BreakPhase::Idle;
            self.next_break_at = None;
        }
    }

    pub fn start_break_now(&mut self, settings: &Settings, now: DateTime<Utc>) -> BreakStart {
        self.phase = BreakPhase::OnBreak;
        self.next_break_at = None;
        self.current_break_started_at = Some(now);
        self.break_end_at =
            Some(now + Duration::seconds(seconds_or_one(settings.break_length_seconds)));
        self.prompted_at = None;
        self.started_from_tray = true;

        BreakStart {
            end_at: self.break_end_at.expect("break end was just set"),
            started_from_tray: true,
        }
    }

    pub fn end_break(&mut self, settings: &Settings, now: DateTime<Utc>) -> BreakEndOutcome {
        if self.phase != BreakPhase::OnBreak {
            return BreakEndOutcome {
                completed: false,
                duration_seconds: 0,
            };
        }

        let duration_ms = self
            .current_break_started_at
            .map(|started_at| {
                now.signed_duration_since(started_at)
                    .num_milliseconds()
                    .max(0)
            })
            .unwrap_or(0);
        let required_ms = i64::from(settings.break_length_seconds.max(1)) * 1000;
        let completed = duration_ms >= required_ms / 2;

        if completed {
            self.last_completed_break_at = now;
        }

        self.current_break_started_at = None;
        self.break_end_at = None;
        self.prompted_at = None;
        self.postponed_count = 0;
        self.started_from_tray = false;

        if settings.breaks_enabled {
            self.phase = BreakPhase::Working;
            self.next_break_at =
                Some(now + Duration::seconds(seconds_or_one(settings.break_frequency_seconds)));
        } else {
            self.phase = BreakPhase::Idle;
            self.next_break_at = None;
        }

        BreakEndOutcome {
            completed,
            duration_seconds: u64::try_from(duration_ms / 1000).unwrap_or(0),
        }
    }

    pub fn allow_postpone(&self, settings: &Settings) -> bool {
        settings.postpone_limit == 0 || self.postponed_count < settings.postpone_limit
    }

    pub fn postpone(
        &mut self,
        settings: &Settings,
        now: DateTime<Utc>,
    ) -> Result<(), BreakActionError> {
        if !self.allow_postpone(settings)
            && matches!(self.phase, BreakPhase::OnBreak | BreakPhase::Postponed)
        {
            return Err(BreakActionError::PostponeLimitReached);
        }
        if self.phase != BreakPhase::OnBreak {
            return Err(BreakActionError::NotOnBreak);
        }

        self.postponed_count += 1;
        self.phase = BreakPhase::Postponed;
        self.current_break_started_at = None;
        self.break_end_at = None;
        self.prompted_at = None;
        self.started_from_tray = false;
        self.next_break_at =
            Some(now + Duration::seconds(seconds_or_one(settings.postpone_length_seconds)));
        Ok(())
    }

    pub fn skip(
        &mut self,
        settings: &Settings,
        now: DateTime<Utc>,
    ) -> Result<(), BreakActionError> {
        if self.phase != BreakPhase::OnBreak {
            return Err(BreakActionError::NotOnBreak);
        }

        self.postponed_count += 1;
        self.phase = BreakPhase::Working;
        self.current_break_started_at = None;
        self.break_end_at = None;
        self.prompted_at = None;
        self.started_from_tray = false;
        self.next_break_at =
            Some(now + Duration::seconds(seconds_or_one(settings.break_frequency_seconds)));
        Ok(())
    }

    pub fn status(&self, settings: &Settings, now: DateTime<Utc>) -> BreakStatus {
        BreakStatus {
            phase: self.phase,
            break_started_at: self
                .current_break_started_at
                .map(|value| value.timestamp_millis()),
            break_end_at: self.break_end_at.map(|value| value.timestamp_millis()),
            next_break_at: self.next_break_at.map(|value| value.timestamp_millis()),
            prompt_started_at: self.prompted_at.map(|value| value.timestamp_millis()),
            prompt_deadline_at: self
                .prompt_deadline_at()
                .map(|value| value.timestamp_millis()),
            time_since_last_break_seconds: now
                .signed_duration_since(self.last_completed_break_at)
                .num_seconds()
                .max(0),
            allow_postpone: self.allow_postpone(settings),
            started_from_tray: self.started_from_tray,
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
    use chrono::Weekday;

    fn settings() -> Settings {
        Settings {
            break_frequency_seconds: 60,
            break_length_seconds: 120,
            postpone_length_seconds: 180,
            postpone_limit: 1,
            ..Settings::default()
        }
    }

    fn at(seconds: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(1_700_000_000 + seconds, 0).unwrap()
    }

    fn context(seconds: i64) -> SchedulerContext {
        SchedulerContext {
            now: at(seconds),
            in_working_hours: true,
            activity: SystemActivity::Active,
        }
    }

    fn tick(scheduler: &mut BreakScheduler, settings: &Settings, seconds: i64) -> BreakTick {
        scheduler.tick(settings, context(seconds))
    }

    fn working_hours(enabled: bool, ranges: &[(u32, u32)]) -> crate::state::settings::WorkingHours {
        crate::state::settings::WorkingHours {
            enabled,
            ranges: ranges
                .iter()
                .map(
                    |&(from_minutes, to_minutes)| crate::state::settings::WorkingHoursRange {
                        from_minutes,
                        to_minutes,
                    },
                )
                .collect(),
        }
    }

    #[test]
    fn working_hours_are_unrestricted_when_the_global_switch_is_off() {
        let settings = Settings {
            working_hours_enabled: false,
            working_hours_saturday: working_hours(false, &[]),
            ..Settings::default()
        };

        assert!(is_in_working_hours_at(&settings, Weekday::Sat, 3 * 60));
    }

    #[test]
    fn a_disabled_day_is_outside_working_hours() {
        let settings = Settings {
            working_hours_monday: working_hours(false, &[(9 * 60, 18 * 60)]),
            ..Settings::default()
        };

        assert!(!is_in_working_hours_at(&settings, Weekday::Mon, 10 * 60));
    }

    #[test]
    fn any_enabled_range_includes_its_boundaries() {
        let settings = Settings {
            working_hours_monday: working_hours(true, &[(9 * 60, 12 * 60), (13 * 60, 18 * 60)]),
            ..Settings::default()
        };

        assert!(is_in_working_hours_at(&settings, Weekday::Mon, 9 * 60));
        assert!(is_in_working_hours_at(&settings, Weekday::Mon, 12 * 60));
        assert!(!is_in_working_hours_at(
            &settings,
            Weekday::Mon,
            12 * 60 + 1
        ));
        assert!(is_in_working_hours_at(&settings, Weekday::Mon, 13 * 60));
        assert!(is_in_working_hours_at(&settings, Weekday::Mon, 18 * 60));
        assert!(!is_in_working_hours_at(
            &settings,
            Weekday::Mon,
            18 * 60 + 1
        ));
    }

    #[test]
    fn entering_working_hours_resets_the_break_countdown() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));

        let outside = SchedulerContext {
            now: at(10),
            in_working_hours: false,
            activity: SystemActivity::Active,
        };
        let inside = SchedulerContext {
            now: at(20),
            in_working_hours: true,
            activity: SystemActivity::Active,
        };

        assert_eq!(scheduler.tick(&settings, outside), BreakTick::None);
        assert_eq!(scheduler.tick(&settings, inside), BreakTick::None);
        assert_eq!(scheduler.last_completed_break_at(), at(20));
        assert_eq!(scheduler.next_break_at(), Some(at(80)));
    }

    #[test]
    fn idle_reset_at_the_threshold_resets_once_and_reports_notification_intent() {
        let settings = Settings {
            break_frequency_seconds: 60,
            idle_reset_enabled: true,
            idle_reset_length_seconds: 30,
            idle_reset_notification: true,
            ..settings()
        };
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        tick(&mut scheduler, &settings, 10);

        let idle = SchedulerContext {
            now: at(30),
            in_working_hours: true,
            activity: SystemActivity::Idle { idle_seconds: 30 },
        };
        let still_idle = SchedulerContext {
            now: at(40),
            in_working_hours: true,
            activity: SystemActivity::Idle { idle_seconds: 40 },
        };
        let active = SchedulerContext {
            now: at(50),
            in_working_hours: true,
            activity: SystemActivity::Active,
        };

        assert_eq!(
            scheduler.tick(&settings, idle),
            BreakTick::IdleReset(IdleReset {
                idle_seconds: 30,
                notify: true,
            })
        );
        assert_eq!(scheduler.last_completed_break_at(), at(30));
        assert_eq!(scheduler.next_break_at(), None);
        assert_eq!(scheduler.tick(&settings, still_idle), BreakTick::None);
        assert_eq!(scheduler.tick(&settings, active), BreakTick::None);
        assert_eq!(scheduler.next_break_at(), Some(at(110)));
    }

    #[test]
    fn idle_reset_keeps_notification_off_when_disabled() {
        let settings = Settings {
            break_frequency_seconds: 60,
            idle_reset_enabled: true,
            idle_reset_length_seconds: 30,
            idle_reset_notification: false,
            ..settings()
        };
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));

        let idle = SchedulerContext {
            now: at(30),
            in_working_hours: true,
            activity: SystemActivity::Idle { idle_seconds: 30 },
        };

        assert_eq!(
            scheduler.tick(&settings, idle),
            BreakTick::IdleReset(IdleReset {
                idle_seconds: 30,
                notify: false,
            })
        );
    }

    #[test]
    fn disabled_idle_reset_ignores_idle_ticks_and_keeps_the_original_schedule() {
        let settings = Settings {
            break_frequency_seconds: 300,
            idle_reset_enabled: false,
            idle_reset_length_seconds: 5,
            ..settings()
        };
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));

        for second in 1..=299 {
            let idle = SchedulerContext {
                now: at(second),
                in_working_hours: true,
                activity: SystemActivity::Idle {
                    idle_seconds: second as u64,
                },
            };

            assert_eq!(
                scheduler.tick(&settings, idle),
                BreakTick::None,
                "tick at {second}s"
            );
            assert_eq!(
                scheduler.next_break_at(),
                Some(at(300)),
                "next break moved after idle tick at {second}s"
            );
        }

        let idle = SchedulerContext {
            now: at(300),
            in_working_hours: true,
            activity: SystemActivity::Idle { idle_seconds: 300 },
        };
        assert_eq!(scheduler.tick(&settings, idle), BreakTick::BreakPrompted);
    }

    #[test]
    fn a_long_tick_gap_skips_the_expired_break_without_an_idle_notification() {
        let settings = Settings {
            break_frequency_seconds: 60,
            idle_reset_enabled: true,
            idle_reset_length_seconds: 30,
            idle_reset_notification: true,
            ..settings()
        };
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));

        let after_suspend = SchedulerContext {
            now: at(180),
            in_working_hours: true,
            activity: SystemActivity::Active,
        };
        let resumed = SchedulerContext {
            now: at(181),
            in_working_hours: true,
            activity: SystemActivity::Active,
        };

        assert_eq!(scheduler.tick(&settings, after_suspend), BreakTick::None);
        assert_eq!(scheduler.last_completed_break_at(), at(180));
        assert_eq!(scheduler.next_break_at(), None);
        assert_eq!(scheduler.tick(&settings, resumed), BreakTick::None);
        assert_eq!(scheduler.next_break_at(), Some(at(241)));
    }

    #[test]
    fn a_long_lock_clears_the_expired_break_and_reschedules_after_unlock() {
        let settings = Settings {
            break_frequency_seconds: 60,
            ..settings()
        };
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        tick(&mut scheduler, &settings, 10);

        let locked = SchedulerContext {
            now: at(30),
            in_working_hours: true,
            activity: SystemActivity::Locked { locked_seconds: 20 },
        };
        let still_locked = SchedulerContext {
            now: at(70),
            in_working_hours: true,
            activity: SystemActivity::Locked { locked_seconds: 60 },
        };
        let long_lock = SchedulerContext {
            now: at(100),
            in_working_hours: true,
            activity: SystemActivity::Locked { locked_seconds: 90 },
        };
        let unlocked = SchedulerContext {
            now: at(101),
            in_working_hours: true,
            activity: SystemActivity::Active,
        };

        assert_eq!(scheduler.tick(&settings, locked), BreakTick::None);
        assert_eq!(scheduler.next_break_at(), None);
        assert_eq!(scheduler.tick(&settings, still_locked), BreakTick::None);
        assert_eq!(scheduler.tick(&settings, long_lock), BreakTick::None);
        assert_eq!(scheduler.last_completed_break_at(), at(0));
        assert_eq!(scheduler.tick(&settings, unlocked), BreakTick::None);
        assert_eq!(scheduler.next_break_at(), Some(at(161)));
    }

    #[test]
    fn starts_idle() {
        assert_eq!(BreakScheduler::new().phase(), BreakPhase::Idle);
    }

    #[test]
    fn restart_schedules_the_next_break_when_enabled() {
        let now = at(0);
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(now);

        scheduler.restart(&settings, now);

        assert_eq!(scheduler.phase(), BreakPhase::Working);
        assert_eq!(scheduler.next_break_at(), Some(now + Duration::seconds(60)));
    }

    #[test]
    fn restart_clears_the_next_break_when_disabled() {
        let now = at(0);
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
        let started_at = at(0);
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

    #[test]
    fn due_tick_prompts_for_a_break_and_schedules_nothing_yet() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));

        assert_eq!(
            tick(&mut scheduler, &settings, 60),
            BreakTick::BreakPrompted
        );
        assert_eq!(scheduler.phase(), BreakPhase::OnBreak);
        assert_eq!(scheduler.break_end_at(), None);
        assert!(!scheduler.is_break_tracking());
    }

    #[test]
    fn immediate_start_enters_a_tracked_break_when_due() {
        let settings = Settings {
            immediately_start_breaks: true,
            ..settings()
        };
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));

        assert_eq!(
            tick(&mut scheduler, &settings, 60),
            BreakTick::BreakStarted(BreakStart {
                end_at: at(180),
                started_from_tray: false,
            })
        );
        assert_eq!(scheduler.break_end_at(), Some(at(180)));
        assert!(scheduler.is_break_tracking());
    }

    #[test]
    fn begin_break_starts_tracking_after_the_prompt() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        assert_eq!(
            tick(&mut scheduler, &settings, 60),
            BreakTick::BreakPrompted
        );

        let start = scheduler.begin_break(&settings, at(61)).unwrap();

        assert_eq!(
            start,
            BreakStart {
                end_at: at(181),
                started_from_tray: false,
            }
        );
        assert_eq!(scheduler.break_end_at(), Some(at(181)));
    }

    #[test]
    fn begin_break_transition_only_reports_the_first_start() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        tick(&mut scheduler, &settings, 60);

        let (first, first_started) = scheduler.begin_break_transition(&settings, at(61)).unwrap();
        let (second, second_started) = scheduler.begin_break_transition(&settings, at(62)).unwrap();

        assert!(first_started);
        assert!(!second_started);
        assert_eq!(first, second);
        assert_eq!(first.end_at, at(181));
    }

    #[test]
    fn prompt_reports_its_grace_and_deadline_timestamps() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        tick(&mut scheduler, &settings, 60);

        let status = scheduler.status(&settings, at(60));

        assert_eq!(status.prompt_started_at, Some(at(60).timestamp_millis()));
        assert_eq!(
            status.prompt_deadline_at,
            Some((at(60) + Duration::seconds(PROMPT_TOTAL_SECONDS)).timestamp_millis())
        );
    }

    #[test]
    fn prompt_auto_starts_the_break_once_the_deadline_passes() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        assert_eq!(
            tick(&mut scheduler, &settings, 60),
            BreakTick::BreakPrompted
        );

        // Still inside the prompt window: nothing happens yet.
        assert_eq!(tick(&mut scheduler, &settings, 179), BreakTick::None);
        // The deadline (60s prompt + 60s countdown) auto-starts the break.
        assert_eq!(
            tick(&mut scheduler, &settings, 180),
            BreakTick::BreakStarted(BreakStart {
                end_at: at(300),
                started_from_tray: false,
            })
        );
        assert!(scheduler.is_break_tracking());
        assert_eq!(scheduler.prompt_deadline_at(), None);
    }

    #[test]
    fn starting_manually_clears_the_prompt_deadline() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        tick(&mut scheduler, &settings, 60);

        scheduler.begin_break(&settings, at(61)).unwrap();

        assert_eq!(scheduler.prompt_started_at(), None);
        assert_eq!(scheduler.prompt_deadline_at(), None);
    }

    #[test]
    fn natural_tick_ends_a_tracked_break() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        assert_eq!(
            tick(&mut scheduler, &settings, 60),
            BreakTick::BreakPrompted
        );
        scheduler.begin_break(&settings, at(60)).unwrap();

        assert_eq!(
            tick(&mut scheduler, &settings, 180),
            BreakTick::BreakEnded(BreakEndOutcome {
                completed: true,
                duration_seconds: 120,
            })
        );
        assert_eq!(scheduler.phase(), BreakPhase::Working);
        assert_eq!(scheduler.next_break_at(), Some(at(240)));
    }

    #[test]
    fn a_break_that_reaches_half_its_length_is_completed() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        tick(&mut scheduler, &settings, 60);
        scheduler.begin_break(&settings, at(60)).unwrap();

        let outcome = scheduler.end_break(&settings, at(120));

        assert_eq!(
            outcome,
            BreakEndOutcome {
                completed: true,
                duration_seconds: 60,
            }
        );
        assert_eq!(scheduler.last_completed_break_at(), at(120));
    }

    #[test]
    fn a_break_shorter_than_half_its_length_is_not_completed() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        tick(&mut scheduler, &settings, 60);
        scheduler.begin_break(&settings, at(60)).unwrap();
        let last_completed = scheduler.last_completed_break_at();

        let outcome = scheduler.end_break(&settings, at(119));

        assert_eq!(
            outcome,
            BreakEndOutcome {
                completed: false,
                duration_seconds: 59,
            }
        );
        assert_eq!(scheduler.last_completed_break_at(), last_completed);
    }

    #[test]
    fn postpone_uses_the_postpone_length_and_respects_the_limit() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        tick(&mut scheduler, &settings, 60);

        assert!(scheduler.allow_postpone(&settings));
        scheduler.postpone(&settings, at(61)).unwrap();

        assert_eq!(scheduler.phase(), BreakPhase::Postponed);
        assert_eq!(scheduler.next_break_at(), Some(at(241)));
        assert!(!scheduler.allow_postpone(&settings));
        assert_eq!(
            scheduler.postpone(&settings, at(62)),
            Err(BreakActionError::PostponeLimitReached)
        );
    }

    #[test]
    fn skip_reschedules_at_the_normal_frequency_and_counts_toward_the_limit() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        tick(&mut scheduler, &settings, 60);

        scheduler.skip(&settings, at(61)).unwrap();

        assert_eq!(scheduler.phase(), BreakPhase::Working);
        assert_eq!(scheduler.next_break_at(), Some(at(121)));
        assert!(!scheduler.allow_postpone(&settings));
    }

    #[test]
    fn start_break_now_immediately_tracks_the_break() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));

        let start = scheduler.start_break_now(&settings, at(30));

        assert_eq!(
            start,
            BreakStart {
                end_at: at(150),
                started_from_tray: true,
            }
        );
        assert_eq!(scheduler.phase(), BreakPhase::OnBreak);
        assert_eq!(scheduler.break_end_at(), Some(at(150)));
    }

    #[test]
    fn notification_mode_completes_a_prompted_break_immediately() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        assert_eq!(
            tick(&mut scheduler, &settings, 60),
            BreakTick::BreakPrompted
        );

        scheduler.complete_notification_break(&settings, at(60));

        assert_eq!(scheduler.phase(), BreakPhase::Working);
        assert_eq!(scheduler.last_completed_break_at(), at(60));
        assert_eq!(scheduler.next_break_at(), Some(at(120)));
        assert_eq!(scheduler.prompt_started_at(), None);
        assert!(!scheduler.is_break_tracking());
    }

    #[test]
    fn notification_mode_completes_an_auto_started_break_immediately() {
        let settings = Settings {
            immediately_start_breaks: true,
            ..settings()
        };
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        assert_eq!(
            tick(&mut scheduler, &settings, 60),
            BreakTick::BreakStarted(BreakStart {
                end_at: at(180),
                started_from_tray: false,
            })
        );

        scheduler.complete_notification_break(&settings, at(60));

        assert_eq!(scheduler.phase(), BreakPhase::Working);
        assert_eq!(scheduler.last_completed_break_at(), at(60));
        assert_eq!(scheduler.next_break_at(), Some(at(120)));
        assert!(!scheduler.is_break_tracking());
    }

    #[test]
    fn restart_does_not_cancel_an_active_break() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.start_break_now(&settings, at(30));
        let end_at = scheduler.break_end_at();

        scheduler.restart(&settings, at(31));

        assert_eq!(scheduler.phase(), BreakPhase::OnBreak);
        assert_eq!(scheduler.break_end_at(), end_at);
        assert_eq!(scheduler.current_break_started_at(), Some(at(30)));
    }

    #[test]
    fn status_exposes_the_frontend_countdown_values() {
        let settings = settings();
        let mut scheduler = BreakScheduler::new_at(at(0));
        scheduler.restart(&settings, at(0));
        scheduler.start_break_now(&settings, at(30));

        let status = scheduler.status(&settings, at(45));

        assert_eq!(status.phase, BreakPhase::OnBreak);
        assert_eq!(status.break_started_at, Some(at(30).timestamp_millis()));
        assert_eq!(status.break_end_at, Some(at(150).timestamp_millis()));
        assert_eq!(status.time_since_last_break_seconds, 45);
        assert!(status.started_from_tray);
    }
}
