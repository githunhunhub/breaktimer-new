mod autostart;
mod breaks;
mod commands;
mod error;
mod flow;
mod notifications;
mod sounds;
mod state;
mod tray;
mod windows;

use std::fs;
use std::time::Duration;

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
            spawn_scheduler_tick(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::get_settings,
            commands::set_settings,
            commands::get_app_info,
            commands::get_break_status,
            commands::begin_break,
            commands::end_break,
            commands::postpone_break,
            commands::skip_break,
            commands::start_break_now,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Drives the scheduler once per second on the main thread.
///
/// Window creation and resizing must run on the main thread, so each tick is
/// dispatched there; the sleeping thread only paces the loop.
fn spawn_scheduler_tick(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_secs(1));

            let dispatch = app.clone();
            let result = app.run_on_main_thread(move || {
                let state = dispatch.state::<AppState>();
                flow::tick(&dispatch, &state);
            });

            if result.is_err() {
                break;
            }
        }
    });
}
