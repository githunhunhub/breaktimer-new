//! Persistent application state (settings, app flags).

pub mod migrations;
pub mod settings;
pub mod store;

pub use settings::Settings;
pub use store::SettingsStore;

/// Shared, managed state available to every Tauri command.
pub struct AppState {
    pub store: SettingsStore,
}

impl AppState {
    pub fn new(store: SettingsStore) -> Self {
        Self { store }
    }
}
