//! System tray initialization (SPEC-0006).
//!
//! M3 establishes the permanent tray icon and the minimum Settings/Quit actions.
//! Dynamic countdown text, disable submenus and break actions are added in M4.

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Runtime};

use crate::error::AppResult;

const TRAY_ID: &str = "main";
const SETTINGS_MENU_ID: &str = "settings";
const QUIT_MENU_ID: &str = "quit";

/// Creates the application tray icon and its M3 menu.
pub fn init<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    let settings = MenuItem::with_id(app, SETTINGS_MENU_ID, "Settings...", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, QUIT_MENU_ID, "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&settings, &quit])?;
    let icon = Image::from_bytes(include_bytes!("../../icons/32x32.png"))?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .tooltip("BreakTimer")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            SETTINGS_MENU_ID => show_settings_window(app),
            QUIT_MENU_ID => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn show_settings_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.show() {
            eprintln!("failed to show settings window: {error}");
        }
        if let Err(error) = window.set_focus() {
            eprintln!("failed to focus settings window: {error}");
        }
    }
}
