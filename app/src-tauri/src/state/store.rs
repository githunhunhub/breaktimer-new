//! Settings and app-state persistence (SPEC-0010).
//!
//! On disk the store is a single JSON object:
//!
//! ```json
//! {
//!   "settings": { ... },
//!   "appInitialized": false,
//!   "settingsVersion": 2,
//!   "disableEndTime": null
//! }
//! ```
//!
//! Migrations run against the raw `settings` JSON before it is parsed into
//! [`Settings`], so legacy-only fields are still visible to the migration chain.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::AppResult;
use crate::state::migrations::{self, CURRENT_SETTINGS_VERSION};
use crate::state::settings::Settings;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreData {
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub app_initialized: bool,
    #[serde(default)]
    pub settings_version: u32,
    #[serde(default)]
    pub disable_end_time: Option<i64>,
    #[serde(default)]
    pub update_last_checked_at: Option<i64>,
    #[serde(default)]
    pub update_last_notified_version: Option<String>,
    #[serde(default)]
    pub install_id: Option<String>,
    #[serde(default)]
    pub install_first_launch_day: Option<String>,
    #[serde(default)]
    pub telemetry_last_ping_day: Option<String>,
    #[serde(default)]
    pub telemetry_install_reported: bool,
}

impl Default for StoreData {
    fn default() -> Self {
        Self {
            settings: Settings::default(),
            app_initialized: false,
            settings_version: CURRENT_SETTINGS_VERSION,
            disable_end_time: None,
            update_last_checked_at: None,
            update_last_notified_version: None,
            install_id: None,
            install_first_launch_day: None,
            telemetry_last_ping_day: None,
            telemetry_install_reported: false,
        }
    }
}

pub struct SettingsStore {
    path: PathBuf,
    data: Mutex<StoreData>,
}

impl SettingsStore {
    /// Loads the store from `path`, running migrations when needed. Missing
    /// files start from defaults.
    pub fn load(path: PathBuf) -> AppResult<Self> {
        if !path.exists() {
            return Ok(Self::new(path, StoreData::default()));
        }

        let raw = fs::read_to_string(&path)?;
        let root: Value = serde_json::from_str(&raw)?;

        let stored_version = root
            .get("settingsVersion")
            .and_then(Value::as_u64)
            .unwrap_or(0) as u32;
        let stored_settings = root.get("settings").cloned().unwrap_or(Value::Null);

        let outcome = migrations::run(stored_settings, stored_version);
        if let Some((version, message)) = &outcome.failure {
            // Leave the file as-is; a failed migration must never corrupt data.
            log::error!("settings migration {version} failed, keeping stored data: {message}");
        }

        let settings = if outcome.settings.is_null() {
            Settings::default()
        } else {
            serde_json::from_value(outcome.settings)?
        };

        let data = StoreData {
            settings,
            app_initialized: root
                .get("appInitialized")
                .and_then(Value::as_bool)
                .unwrap_or(false),
            settings_version: outcome.version,
            disable_end_time: root.get("disableEndTime").and_then(Value::as_i64),
            update_last_checked_at: root.get("updateLastCheckedAt").and_then(Value::as_i64),
            update_last_notified_version: root
                .get("updateLastNotifiedVersion")
                .and_then(Value::as_str)
                .map(str::to_string),
            install_id: root
                .get("installId")
                .and_then(Value::as_str)
                .map(str::to_string),
            install_first_launch_day: root
                .get("installFirstLaunchDay")
                .and_then(Value::as_str)
                .map(str::to_string),
            telemetry_last_ping_day: root
                .get("telemetryLastPingDay")
                .and_then(Value::as_str)
                .map(str::to_string),
            telemetry_install_reported: root
                .get("telemetryInstallReported")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        };

        let store = Self::new(path, data);
        if outcome.failure.is_none() {
            store.persist()?;
        }
        Ok(store)
    }

    fn new(path: PathBuf, data: StoreData) -> Self {
        Self {
            path,
            data: Mutex::new(data),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn settings(&self) -> Settings {
        self.with_data(|data| data.settings.clone())
    }

    /// Persists `settings`.
    ///
    /// Turning breaks on also drops a pending `disableEndTime`: the deadline
    /// only means something while breaks are off (SPEC-0006, ADR-0006).
    pub fn set_settings(&self, settings: Settings) -> AppResult<()> {
        let clears_disable_end_time = settings.breaks_enabled;
        self.with_data(|data| data.settings = settings);
        if clears_disable_end_time {
            self.with_data(|data| data.disable_end_time = None);
        }
        self.persist()
    }

    #[allow(dead_code)]
    pub fn app_initialized(&self) -> bool {
        self.with_data(|data| data.app_initialized)
    }

    #[allow(dead_code)]
    pub fn set_app_initialized(&self, initialized: bool) -> AppResult<()> {
        self.with_data(|data| data.app_initialized = initialized);
        self.persist()
    }

    pub fn disable_end_time(&self) -> Option<i64> {
        self.with_data(|data| data.disable_end_time)
    }

    pub fn set_disable_end_time(&self, end_time: Option<i64>) -> AppResult<()> {
        self.with_data(|data| data.disable_end_time = end_time);
        self.persist()
    }

    pub fn update_last_checked_at(&self) -> Option<i64> {
        self.with_data(|data| data.update_last_checked_at)
    }

    pub fn set_update_last_checked_at(&self, checked_at: Option<i64>) -> AppResult<()> {
        self.with_data(|data| data.update_last_checked_at = checked_at);
        self.persist()
    }

    pub fn update_last_notified_version(&self) -> Option<String> {
        self.with_data(|data| data.update_last_notified_version.clone())
    }

    pub fn set_update_last_notified_version(&self, version: Option<String>) -> AppResult<()> {
        self.with_data(|data| data.update_last_notified_version = version);
        self.persist()
    }

    /// Creates the anonymous installation identity (SPEC-0018).
    ///
    /// The id is a locally generated UUID and the first-launch day is the local
    /// calendar day, so a first launch without a network connection still gets
    /// counted on the right day once it can report.
    pub fn ensure_install_identity(&self, day: &str) -> AppResult<()> {
        let missing = self
            .with_data(|data| data.install_id.is_none() || data.install_first_launch_day.is_none());
        if !missing {
            return Ok(());
        }

        self.with_data(|data| {
            if data.install_id.is_none() {
                data.install_id = Some(uuid::Uuid::new_v4().to_string());
            }
            if data.install_first_launch_day.is_none() {
                data.install_first_launch_day = Some(day.to_string());
            }
        });
        self.persist()
    }

    pub fn install_id(&self) -> Option<String> {
        self.with_data(|data| data.install_id.clone())
    }

    pub fn install_first_launch_day(&self) -> Option<String> {
        self.with_data(|data| data.install_first_launch_day.clone())
    }

    pub fn telemetry_last_ping_day(&self) -> Option<String> {
        self.with_data(|data| data.telemetry_last_ping_day.clone())
    }

    pub fn set_telemetry_last_ping_day(&self, day: Option<String>) -> AppResult<()> {
        self.with_data(|data| data.telemetry_last_ping_day = day);
        self.persist()
    }

    pub fn telemetry_install_reported(&self) -> bool {
        self.with_data(|data| data.telemetry_install_reported)
    }

    pub fn set_telemetry_install_reported(&self, reported: bool) -> AppResult<()> {
        self.with_data(|data| data.telemetry_install_reported = reported);
        self.persist()
    }

    fn with_data<T>(&self, f: impl FnOnce(&mut StoreData) -> T) -> T {
        let mut guard = self
            .data
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        f(&mut guard)
    }

    fn persist(&self) -> AppResult<()> {
        let snapshot = self.with_data(|data| data.clone());
        let json = serde_json::to_string_pretty(&snapshot)?;
        fs::write(&self.path, json)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join("breaktimer-new-tests");
        fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    #[test]
    fn round_trips_settings() {
        let path = temp_path("round-trip.json");
        let _ = fs::remove_file(&path);

        let store = SettingsStore::load(path.clone()).unwrap();
        assert_eq!(store.settings().break_frequency_seconds, 28 * 60);

        let mut settings = store.settings();
        settings.break_frequency_seconds = 900;
        store.set_settings(settings).unwrap();

        let reloaded = SettingsStore::load(path.clone()).unwrap();
        assert_eq!(reloaded.settings().break_frequency_seconds, 900);

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn merges_defaults_for_partial_files() {
        let path = temp_path("partial.json");
        fs::write(&path, r#"{"settings": {"breakLengthSeconds": 45}}"#).unwrap();

        let store = SettingsStore::load(path.clone()).unwrap();
        let settings = store.settings();

        assert_eq!(settings.break_length_seconds, 45);
        assert_eq!(settings.sound_type, crate::state::settings::SoundType::Gong);
        assert_eq!(store.path(), path.as_path());

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn saving_while_disabled_keeps_the_timed_disable_deadline() {
        let path = temp_path("keep-disable-end-time.json");
        let _ = fs::remove_file(&path);

        let store = SettingsStore::load(path.clone()).unwrap();
        let settings = store.settings();
        store
            .set_settings(Settings {
                breaks_enabled: false,
                ..settings.clone()
            })
            .unwrap();
        store.set_disable_end_time(Some(1_700_000_000)).unwrap();

        store
            .set_settings(Settings {
                breaks_enabled: false,
                break_frequency_seconds: 900,
                ..settings
            })
            .unwrap();

        assert_eq!(store.disable_end_time(), Some(1_700_000_000));
        let reloaded = SettingsStore::load(path.clone()).unwrap();
        assert_eq!(reloaded.disable_end_time(), Some(1_700_000_000));

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn enabling_breaks_clears_the_timed_disable_deadline() {
        let path = temp_path("clear-disable-end-time.json");
        let _ = fs::remove_file(&path);

        let store = SettingsStore::load(path.clone()).unwrap();
        let settings = store.settings();
        store
            .set_settings(Settings {
                breaks_enabled: false,
                ..settings.clone()
            })
            .unwrap();
        store.set_disable_end_time(Some(1_700_000_000)).unwrap();

        store
            .set_settings(Settings {
                breaks_enabled: true,
                ..settings
            })
            .unwrap();

        assert_eq!(store.disable_end_time(), None);
        let reloaded = SettingsStore::load(path.clone()).unwrap();
        assert!(reloaded.settings().breaks_enabled);
        assert_eq!(reloaded.disable_end_time(), None);

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn round_trips_update_metadata_and_preserves_it_on_settings_save() {
        let path = temp_path("update-metadata.json");
        let _ = fs::remove_file(&path);

        let store = SettingsStore::load(path.clone()).unwrap();
        store
            .set_update_last_checked_at(Some(1_700_000_000))
            .unwrap();
        store
            .set_update_last_notified_version(Some("0.1.2".to_string()))
            .unwrap();

        let settings = store.settings();
        store
            .set_settings(Settings {
                break_frequency_seconds: 900,
                ..settings
            })
            .unwrap();

        let reloaded = SettingsStore::load(path.clone()).unwrap();
        assert_eq!(reloaded.update_last_checked_at(), Some(1_700_000_000));
        assert_eq!(
            reloaded.update_last_notified_version().as_deref(),
            Some("0.1.2")
        );
        assert_eq!(reloaded.settings().break_frequency_seconds, 900);

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn install_identity_is_created_once_and_survives_reloads() {
        let path = temp_path("install-identity.json");
        let _ = fs::remove_file(&path);

        let store = SettingsStore::load(path.clone()).unwrap();
        assert!(store.install_id().is_none());

        store.ensure_install_identity("2026-10-30").unwrap();
        let install_id = store.install_id().unwrap();
        assert_eq!(install_id.len(), 36);
        assert_eq!(
            store.install_first_launch_day().as_deref(),
            Some("2026-10-30")
        );

        // A later launch (or an upgrade) keeps the same installation.
        store.ensure_install_identity("2026-11-02").unwrap();
        assert_eq!(store.install_id().as_deref(), Some(install_id.as_str()));
        assert_eq!(
            store.install_first_launch_day().as_deref(),
            Some("2026-10-30")
        );

        let reloaded = SettingsStore::load(path.clone()).unwrap();
        assert_eq!(reloaded.install_id().as_deref(), Some(install_id.as_str()));
        assert_eq!(
            reloaded.install_first_launch_day().as_deref(),
            Some("2026-10-30")
        );

        fs::remove_file(path).unwrap();
    }

    #[test]
    fn saving_settings_preserves_telemetry_metadata() {
        let path = temp_path("telemetry-metadata.json");
        let _ = fs::remove_file(&path);

        let store = SettingsStore::load(path.clone()).unwrap();
        store.ensure_install_identity("2026-11-02").unwrap();
        store
            .set_telemetry_last_ping_day(Some("2026-11-02".to_string()))
            .unwrap();
        store.set_telemetry_install_reported(true).unwrap();

        let settings = store.settings();
        store
            .set_settings(Settings {
                break_length_seconds: 45,
                ..settings
            })
            .unwrap();

        let reloaded = SettingsStore::load(path.clone()).unwrap();
        assert!(reloaded.install_id().is_some());
        assert_eq!(
            reloaded.telemetry_last_ping_day().as_deref(),
            Some("2026-11-02")
        );
        assert!(reloaded.telemetry_install_reported());

        fs::remove_file(path).unwrap();
    }
}
