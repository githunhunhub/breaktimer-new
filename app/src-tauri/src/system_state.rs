//! Platform system activity collection (SPEC-0003, SPEC-0005).

use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::breaks::SystemActivity;

/// Supplies the scheduler with the current activity state.
pub trait SystemStateProvider: Send + Sync {
    fn activity(&self) -> SystemActivity;
}

/// Native system state provider.
pub struct NativeSystemStateProvider {
    lock_started_at: Mutex<Option<Instant>>,
}

impl NativeSystemStateProvider {
    pub fn new() -> Self {
        Self {
            lock_started_at: Mutex::new(None),
        }
    }

    /// Records the latest lock observation and reports the lock activity.
    ///
    /// Returns `None` once the session is unlocked, so the caller can fall
    /// back to the idle-time reading.
    pub fn update_lock_state(&self, locked: bool, now: Instant) -> Option<SystemActivity> {
        let mut lock_started_at = self
            .lock_started_at
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        if !locked {
            *lock_started_at = None;
            return None;
        }

        let started_at = *lock_started_at.get_or_insert(now);
        Some(SystemActivity::Locked {
            locked_seconds: now.saturating_duration_since(started_at).as_secs(),
        })
    }
}

impl Default for NativeSystemStateProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl SystemStateProvider for NativeSystemStateProvider {
    fn activity(&self) -> SystemActivity {
        if let Some(locked) = platform_lock_state() {
            if let Some(activity) = self.update_lock_state(locked, Instant::now()) {
                return activity;
            }
        }

        match system_idle_time::get_idle_time() {
            Ok(idle) => classify_idle(idle),
            Err(_) => SystemActivity::Unavailable,
        }
    }
}

/// Maps an idle duration to a scheduler activity value (SPEC-0005).
///
/// Any idle time below one whole second is treated as active; the scheduler
/// itself compares the reported seconds against `idleResetLengthSeconds`.
fn classify_idle(idle: Duration) -> SystemActivity {
    let idle_seconds = idle.as_secs();
    if idle_seconds == 0 {
        SystemActivity::Active
    } else {
        SystemActivity::Idle { idle_seconds }
    }
}

/// Reports the OS lock state when the platform exposes a reliable query.
///
/// Only Windows is implemented (ADR-0005); elsewhere the scheduler falls back
/// to idle-time semantics.
#[cfg(windows)]
fn platform_lock_state() -> Option<bool> {
    use windows_sys::Win32::System::StationsAndDesktops::{
        CloseDesktop, DESKTOP_READOBJECTS, OpenInputDesktop,
    };

    // When the workstation is locked, the input desktop is owned by the secure
    // desktop and `OpenInputDesktop` fails with a null handle.
    unsafe {
        let desktop = OpenInputDesktop(0, 0, DESKTOP_READOBJECTS);
        if desktop.is_null() {
            Some(true)
        } else {
            let _ = CloseDesktop(desktop);
            Some(false)
        }
    }
}

#[cfg(not(windows))]
fn platform_lock_state() -> Option<bool> {
    None
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::*;

    #[test]
    fn lock_activity_tracks_duration_and_clears_after_unlock() {
        let provider = NativeSystemStateProvider::new();
        let locked_at = Instant::now();

        assert_eq!(
            provider.update_lock_state(true, locked_at),
            Some(SystemActivity::Locked { locked_seconds: 0 })
        );
        assert_eq!(
            provider.update_lock_state(true, locked_at + Duration::from_secs(90)),
            Some(SystemActivity::Locked { locked_seconds: 90 })
        );
        assert_eq!(
            provider.update_lock_state(false, locked_at + Duration::from_secs(100)),
            None
        );
        assert_eq!(
            provider.update_lock_state(true, locked_at + Duration::from_secs(101)),
            Some(SystemActivity::Locked { locked_seconds: 0 })
        );
    }

    #[test]
    fn classify_idle_reports_active_only_without_idle_time() {
        assert_eq!(
            classify_idle(Duration::from_millis(0)),
            SystemActivity::Active
        );
        assert_eq!(
            classify_idle(Duration::from_millis(900)),
            SystemActivity::Active
        );
        assert_eq!(
            classify_idle(Duration::from_secs(42)),
            SystemActivity::Idle { idle_seconds: 42 }
        );
    }
}
