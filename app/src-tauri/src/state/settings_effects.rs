//! Side effects caused by saving settings (SPEC-0010).

use crate::state::Settings;

/// The changes a settings save must apply after persistence succeeds.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SettingsEffects {
    /// Present only when the launch-at-login preference changed.
    pub auto_launch: Option<bool>,
    /// True only when breaks transition from disabled to enabled.
    pub reset_time_since_last_break: bool,
    /// The scheduler restarts when the frequency or enabled state changes.
    pub restart_scheduler: bool,
}

impl SettingsEffects {
    pub fn between(current: &Settings, next: &Settings) -> Self {
        Self {
            auto_launch: (current.auto_launch != next.auto_launch).then_some(next.auto_launch),
            reset_time_since_last_break: !current.breaks_enabled && next.breaks_enabled,
            restart_scheduler: current.break_frequency_seconds != next.break_frequency_seconds
                || current.breaks_enabled != next.breaks_enabled,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_auto_launch_being_enabled() {
        let current = Settings {
            auto_launch: false,
            ..Settings::default()
        };
        let next = Settings {
            auto_launch: true,
            ..current.clone()
        };

        assert_eq!(
            SettingsEffects::between(&current, &next).auto_launch,
            Some(true)
        );
    }

    #[test]
    fn detects_auto_launch_being_disabled() {
        let current = Settings::default();
        let next = Settings {
            auto_launch: false,
            ..current.clone()
        };

        assert_eq!(
            SettingsEffects::between(&current, &next).auto_launch,
            Some(false)
        );
    }

    #[test]
    fn ignores_unchanged_auto_launch() {
        let current = Settings::default();
        let next = Settings {
            break_frequency_seconds: 900,
            ..current.clone()
        };

        assert_eq!(SettingsEffects::between(&current, &next).auto_launch, None);
    }

    #[test]
    fn resets_time_since_last_break_when_breaks_turn_on() {
        let current = Settings {
            breaks_enabled: false,
            ..Settings::default()
        };
        let next = Settings {
            breaks_enabled: true,
            ..current.clone()
        };

        assert!(SettingsEffects::between(&current, &next).reset_time_since_last_break);
    }

    #[test]
    fn does_not_reset_time_since_last_break_for_other_transitions() {
        let enabled = Settings::default();
        let disabled = Settings {
            breaks_enabled: false,
            ..enabled.clone()
        };

        assert!(
            !SettingsEffects::between(&enabled, &enabled).reset_time_since_last_break,
            "saving while already enabled must not reset the timer"
        );
        assert!(
            !SettingsEffects::between(&enabled, &disabled).reset_time_since_last_break,
            "disabling breaks must not reset the timer"
        );
        assert!(
            !SettingsEffects::between(&disabled, &disabled).reset_time_since_last_break,
            "saving while already disabled must not reset the timer"
        );
    }

    #[test]
    fn restarts_only_for_frequency_or_enabled_state_changes() {
        let current = Settings::default();
        let unrelated = Settings {
            break_length_seconds: 90,
            ..current.clone()
        };
        let frequency_changed = Settings {
            break_frequency_seconds: 900,
            ..current.clone()
        };
        let enabled_changed = Settings {
            breaks_enabled: false,
            ..current.clone()
        };

        assert!(
            !SettingsEffects::between(&current, &unrelated).restart_scheduler,
            "saving an unrelated setting must keep the current countdown"
        );
        assert!(SettingsEffects::between(&current, &frequency_changed).restart_scheduler);
        assert!(SettingsEffects::between(&current, &enabled_changed).restart_scheduler);
    }
}
