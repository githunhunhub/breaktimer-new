//! Persistent application state (settings, app flags).

use std::sync::Mutex;

use chrono::{DateTime, Utc};

use crate::breaks::BreakScheduler;

pub mod migrations;
pub mod settings;
pub mod settings_effects;
pub mod store;

pub use settings::Settings;
pub use settings_effects::SettingsEffects;
pub use store::SettingsStore;

/// Shared, managed state available to every Tauri command.
pub struct AppState {
    pub store: SettingsStore,
    scheduler: Mutex<BreakScheduler>,
}

impl AppState {
    pub fn new(store: SettingsStore) -> Self {
        Self {
            store,
            scheduler: Mutex::new(BreakScheduler::new()),
        }
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

    use chrono::Duration;

    use super::*;
    use crate::breaks::BreakPhase;

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
}
