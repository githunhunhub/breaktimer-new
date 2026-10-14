mod autostart;
mod breaks;
mod commands;
mod error;
mod notifications;
mod sounds;
mod state;
mod tray;
mod windows;

use std::fs;

use tauri::Manager;

use state::{AppState, SettingsStore};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Register first: re-launches are handled before any other plugin setup.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("BreakTimer")
                .build(),
        )
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            fs::create_dir_all(&config_dir)?;

            let store = SettingsStore::load(config_dir.join("settings.json"))?;
            app.manage(AppState::new(store));

            let handle = app.handle();
            tray::init(handle)?;
            windows::init(handle)?;
            sounds::init(handle)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_settings,
            commands::set_settings,
            commands::get_app_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
