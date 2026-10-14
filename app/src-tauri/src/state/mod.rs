//! Persistent application state (settings, app flags).

use std::sync::Mutex;

use chrono::{DateTime, Datelike, Local, Timelike, Utc};

use crate::breaks::{
    BreakActionError, BreakEndOutcome, BreakPhase, BreakScheduler, BreakStart, BreakStatus,
    BreakTick, SchedulerContext, is_in_working_hours_at,
};
use crate::system_state::{NativeSystemStateProvider, SystemStateProvider};

pub mod migrations;
pub mod settings;
pub mod settings_effects;
pub mod store;

pub use settings::{Settings, SoundType};
pub use settings_effects::SettingsEffects;
pub use store::SettingsStore;

/// Shared, managed state available to every Tauri command.
pub struct AppState {
    pub store: SettingsStore,
    scheduler: Mutex<BreakScheduler>,
    system_state: Box<dyn SystemStateProvider>,
}

impl AppState {
    pub fn new(store: SettingsStore) -> Self {
        Self::new_with_system_state_provider(store, Box::new(NativeSystemStateProvider::new()))
    }

    pub fn new_with_system_state_provider(
        store: SettingsStore,
        system_state: Box<dyn SystemStateProvider>,
    ) -> Self {
        Self {
            store,
            scheduler: Mutex::new(BreakScheduler::new()),
            system_state,
        }
    }

    /// Runs `f` against the scheduler while holding the lock, handing it the
    /// current settings snapshot so callers never touch the mutex directly.
    fn with_scheduler<T>(&self, f: impl FnOnce(&mut BreakScheduler, &Settings) -> T) -> T {
        let settings = self.store.settings();
        let mut scheduler = self
            .scheduler
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        f(&mut scheduler, &settings)
    }

    /// Frontend-facing scheduler snapshot (SPEC-0003).
    pub fn break_status(&self, now: DateTime<Utc>) -> BreakStatus {
        self.with_scheduler(|scheduler, settings| scheduler.status(settings, now))
    }

    /// Advances the scheduler by one tick (SPEC-0003).
    pub fn tick(&self, now: DateTime<Utc>) -> BreakTick {
        let settings = self.store.settings();
        let local = now.with_timezone(&Local);
        let in_working_hours = is_in_working_hours_at(
            &settings,
            local.weekday(),
            local.hour() * 60 + local.minute(),
        );
        let activity = self.system_state.activity();

        let mut scheduler = self
            .scheduler
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        scheduler.tick(
            &settings,
            SchedulerContext {
                now,
                in_working_hours,
                activity,
            },
        )
    }

    /// Starts tracking a prompted break and reports whether this call was the
    /// transition that created the tracked break (SPEC-0003).
    pub fn begin_break_transition(
        &self,
        now: DateTime<Utc>,
    ) -> Result<(BreakStart, bool), BreakActionError> {
        self.with_scheduler(|scheduler, settings| scheduler.begin_break_transition(settings, now))
    }

    /// Ends the active break and reports whether this call actually ended one
    /// (SPEC-0003). The flag is computed while holding the scheduler lock so
    /// multiple overlay windows cannot duplicate end effects.
    pub fn end_break_transition(&self, now: DateTime<Utc>) -> (BreakEndOutcome, bool) {
        self.with_scheduler(|scheduler, settings| {
            let was_on_break = scheduler.phase() == BreakPhase::OnBreak;
            let outcome = scheduler.end_break(settings, now);
            (outcome, was_on_break)
        })
    }

    /// Postpones the active break by `postponeLengthSeconds` (SPEC-0003).
    pub fn postpone_break(&self, now: DateTime<Utc>) -> Result<(), BreakActionError> {
        self.with_scheduler(|scheduler, settings| scheduler.postpone(settings, now))
    }

    /// Skips the active break and reschedules at the normal frequency (SPEC-0003).
    pub fn skip_break(&self, now: DateTime<Utc>) -> Result<(), BreakActionError> {
        self.with_scheduler(|scheduler, settings| scheduler.skip(settings, now))
    }

    /// Starts a break immediately, bypassing the countdown (SPEC-0003).
    pub fn start_break_now(&self, now: DateTime<Utc>) -> BreakStart {
        self.with_scheduler(|scheduler, settings| scheduler.start_break_now(settings, now))
    }

    /// Applies the scheduler portion of a settings save.
    pub fn apply_settings_effects(
        &self,
        settings: &Settings,
        effects: SettingsEffects,
        now: DateTime<Utc>,
    ) {
        let mut scheduler = self
            .scheduler
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if effects.reset_time_since_last_break {
            scheduler.reset_time_since_last_break(now);
        }
        if effects.restart_scheduler {
            scheduler.restart(settings, now);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::PathBuf;
    use std::sync::Mutex;

    use chrono::Duration;

    use super::*;
    use crate::breaks::{BreakActionError, BreakPhase, BreakTick, SystemActivity};
    use crate::system_state::SystemStateProvider;

    struct FakeSystemStateProvider {
        activities: Mutex<Vec<SystemActivity>>,
    }

    impl FakeSystemStateProvider {
        fn new(activities: Vec<SystemActivity>) -> Self {
            Self {
                activities: Mutex::new(activities),
            }
        }
    }

    impl SystemStateProvider for FakeSystemStateProvider {
        fn activity(&self) -> SystemActivity {
            let mut activities = self.activities.lock().unwrap();
            if activities.len() > 1 {
                activities.remove(0)
            } else {
                activities
                    .first()
                    .copied()
                    .unwrap_or(SystemActivity::Active)
            }
        }
    }

    fn temp_store(name: &str) -> SettingsStore {
        let dir = std::env::temp_dir().join("breaktimer-state-tests");
        fs::create_dir_all(&dir).unwrap();
        SettingsStore::load(PathBuf::from(dir).join(name)).unwrap()
    }

    #[test]
    fn applies_reset_and_restart_to_the_scheduler() {
        let store = temp_store("settings-effects.json");
        let state = AppState::new(store);
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        let settings = Settings {
            break_frequency_seconds: 60,
            ..Settings::default()
        };
        let effects = SettingsEffects {
            auto_launch: None,
            reset_time_since_last_break: true,
            restart_scheduler: true,
        };

        state.apply_settings_effects(&settings, effects, now);

        let scheduler = state
            .scheduler
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        assert_eq!(scheduler.last_completed_break_at(), now);
        assert_eq!(scheduler.phase(), BreakPhase::Working);
        assert_eq!(scheduler.next_break_at(), Some(now + Duration::seconds(60)));
    }

    #[test]
    fn can_restart_without_resetting_the_timer() {
        let store = temp_store("settings-effects-restart-only.json");
        let state = AppState::new(store);
        let started_at = DateTime::from_timestamp(1_700_000_000, 0).unwrap();
        let now = started_at + Duration::seconds(30);
        let settings = Settings {
            break_frequency_seconds: 120,
            ..Settings::default()
        };
        let effects = SettingsEffects {
            auto_launch: None,
            reset_time_since_last_break: false,
            restart_scheduler: true,
        };

        {
            let mut scheduler = state
                .scheduler
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            scheduler.reset_time_since_last_break(started_at);
        }

        state.apply_settings_effects(&settings, effects, now);

        let scheduler = state
            .scheduler
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        assert_eq!(scheduler.last_completed_break_at(), started_at);
        assert_eq!(scheduler.phase(), BreakPhase::Working);
        assert_eq!(
            scheduler.next_break_at(),
            Some(now + Duration::seconds(120))
        );
    }

    #[test]
    fn drives_the_scheduler_from_stored_settings() {
        let store = temp_store("appstate-drive.json");
        let settings = Settings {
            break_frequency_seconds: 60,
            immediately_start_breaks: false,
            working_hours_enabled: false,
            ..Settings::default()
        };
        store.set_settings(settings).unwrap();
        let state = AppState::new(store);
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();

        assert_eq!(state.tick(now), BreakTick::None);
        assert_eq!(
            state.tick(now + Duration::seconds(60)),
            BreakTick::BreakPrompted
        );

        let (start, started) = state
            .begin_break_transition(now + Duration::seconds(60))
            .unwrap();
        assert!(started);
        assert_eq!(start.end_at, now + Duration::seconds(60 + 120));

        let status = state.break_status(now + Duration::seconds(70));
        assert_eq!(status.phase, BreakPhase::OnBreak);
        assert!(status.break_started_at.is_some());
    }

    #[test]
    fn postpones_until_the_limit_is_reached() {
        let store = temp_store("appstate-postpone.json");
        let settings = Settings {
            break_frequency_seconds: 60,
            postpone_limit: 1,
            working_hours_enabled: false,
            ..Settings::default()
        };
        store.set_settings(settings).unwrap();
        let state = AppState::new(store);
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();

        state.tick(now);
        assert_eq!(
            state.tick(now + Duration::seconds(60)),
            BreakTick::BreakPrompted
        );
        state.postpone_break(now + Duration::seconds(61)).unwrap();

        assert_eq!(
            state.postpone_break(now + Duration::seconds(62)),
            Err(BreakActionError::PostponeLimitReached)
        );
    }

    #[test]
    fn reports_only_the_first_end_transition() {
        let store = temp_store("appstate-end-transition.json");
        let settings = Settings {
            break_frequency_seconds: 60,
            break_length_seconds: 120,
            working_hours_enabled: false,
            ..Settings::default()
        };
        store.set_settings(settings).unwrap();
        let state = AppState::new(store);
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();

        state.tick(now);
        state.tick(now + Duration::seconds(60));
        let (_, started) = state
            .begin_break_transition(now + Duration::seconds(60))
            .unwrap();
        assert!(started);

        let (first, first_ended) = state.end_break_transition(now + Duration::seconds(120));
        let (second, second_ended) = state.end_break_transition(now + Duration::seconds(121));

        assert!(first_ended);
        assert!(!second_ended);
        assert!(first.completed);
        assert!(!second.completed);
    }

    #[test]
    fn tick_uses_the_system_state_provider_and_reports_an_idle_reset() {
        let store = temp_store("appstate-idle-provider.json");
        store
            .set_settings(Settings {
                break_frequency_seconds: 60,
                working_hours_enabled: false,
                idle_reset_enabled: true,
                idle_reset_length_seconds: 30,
                idle_reset_notification: true,
                ..Settings::default()
            })
            .unwrap();
        let state = AppState::new_with_system_state_provider(
            store,
            Box::new(FakeSystemStateProvider::new(vec![
                SystemActivity::Active,
                SystemActivity::Idle { idle_seconds: 30 },
            ])),
        );
        let now = DateTime::from_timestamp(1_700_000_000, 0).unwrap();

        assert_eq!(state.tick(now), BreakTick::None);
        assert_eq!(
            state.tick(now + Duration::seconds(30)),
            BreakTick::IdleReset(crate::breaks::IdleReset {
                idle_seconds: 30,
                notify: true,
            })
        );
    }
}
