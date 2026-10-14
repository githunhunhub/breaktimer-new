//! Break window management (SPEC-0002).
//!
//! Break windows are per-display soft overlays created when a break is
//! prompted. They are labelled with [`BREAK_WINDOW_PREFIX`] so the rest of the
//! backend can find and close them without tracking a list.
//!
//! The overlay never steals focus: windows are created with `focusable: false`
//! and shown without focusing. The backdrop is emulated by sizing a borderless
//! window to the monitor bounds rather than entering native fullscreen, which
//! would switch macOS spaces and steal focus (see ADR-0004).

use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::error::AppResult;
use crate::state::Settings;

/// Label prefix for every break overlay window.
pub const BREAK_WINDOW_PREFIX: &str = "break-";

/// Prompt bar base size, in logical pixels. The width grows when the optional
/// postpone/skip buttons are enabled, matching the legacy window layout.
const PROMPT_BASE_WIDTH: f64 = 450.0;
const PROMPT_BUTTON_WIDTH: f64 = 50.0;
const PROMPT_THREE_BUTTON_EXTRA: f64 = 20.0;
const PROMPT_HEIGHT: f64 = 88.0;
/// Distance from the top of the monitor to the prompt bar, in logical pixels.
const PROMPT_TOP_OFFSET: f64 = 48.0;

/// Centred break card size when the backdrop is disabled, in logical pixels.
const BREAK_CARD_WIDTH: f64 = 500.0;
const BREAK_CARD_HEIGHT: f64 = 300.0;

/// Physical bounds of one monitor, detached from the Tauri handle so geometry
/// can be unit-tested without a running application.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MonitorBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

impl MonitorBounds {
    fn from_monitor(monitor: &tauri::Monitor) -> Self {
        Self {
            x: monitor.position().x,
            y: monitor.position().y,
            width: monitor.size().width,
            height: monitor.size().height,
            scale_factor: monitor.scale_factor(),
        }
    }
}

/// A resolved window layout, in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

fn scale(value: f64, scale_factor: f64) -> u32 {
    (value * scale_factor.max(1.0)).round() as u32
}

/// Geometry for the pre-break prompt: a slim bar centred horizontally near the
/// top of the monitor.
pub fn prompt_geometry(monitor: MonitorBounds, width: f64) -> WindowGeometry {
    let width = scale(width, monitor.scale_factor);
    let height = scale(PROMPT_HEIGHT, monitor.scale_factor);
    let x = monitor.x + (monitor.width as i32 - width as i32) / 2;
    let y = monitor.y + scale(PROMPT_TOP_OFFSET, monitor.scale_factor) as i32;
    WindowGeometry {
        x,
        y,
        width,
        height,
    }
}

/// Geometry for a centred break card (`showBackdrop == false`).
pub fn card_geometry(monitor: MonitorBounds) -> WindowGeometry {
    let width = scale(BREAK_CARD_WIDTH, monitor.scale_factor);
    let height = scale(BREAK_CARD_HEIGHT, monitor.scale_factor);
    let x = monitor.x + (monitor.width as i32 - width as i32) / 2;
    let y = monitor.y + (monitor.height as i32 - height as i32) / 2;
    WindowGeometry {
        x,
        y,
        width,
        height,
    }
}

/// Geometry that covers the whole monitor (`showBackdrop == true`).
pub fn backdrop_geometry(monitor: MonitorBounds) -> WindowGeometry {
    WindowGeometry {
        x: monitor.x,
        y: monitor.y,
        width: monitor.width,
        height: monitor.height,
    }
}

/// Closes every open break window.
///
/// Both the natural end of a break and a manual "end break" go through this so
/// no overlay is ever left behind.
pub fn close_all<R: Runtime>(app: &AppHandle<R>) {
    for (label, window) in app.webview_windows() {
        if label.starts_with(BREAK_WINDOW_PREFIX) {
            if let Err(error) = window.close() {
                eprintln!("failed to close break window {label}: {error}");
            }
        }
    }
}

/// Shows the pre-break prompt on every monitor.
pub fn show_prompt<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> AppResult<()> {
    close_all(app);
    ensure_windows(app)?;

    let width = prompt_width(settings);
    for (index, monitor) in monitors(app)?.iter().enumerate() {
        let Some(window) = app.get_webview_window(&label_for(index)) else {
            continue;
        };
        apply_geometry(
            &window,
            prompt_geometry(MonitorBounds::from_monitor(monitor), width),
        );
        reveal(&window);
    }

    Ok(())
}

fn prompt_width(settings: &Settings) -> f64 {
    let mut button_count = 1;
    if settings.postpone_break_enabled {
        button_count += 1;
    }
    if settings.skip_break_enabled {
        button_count += 1;
    }

    PROMPT_BASE_WIDTH
        + (button_count - 1) as f64 * PROMPT_BUTTON_WIDTH
        + if button_count == 3 {
            PROMPT_THREE_BUTTON_EXTRA
        } else {
            0.0
        }
}

/// Shows the active break on every monitor, sized according to `showBackdrop`.
pub fn show_break<R: Runtime>(app: &AppHandle<R>, settings: &Settings) -> AppResult<()> {
    ensure_windows(app)?;

    for (index, monitor) in monitors(app)?.iter().enumerate() {
        let Some(window) = app.get_webview_window(&label_for(index)) else {
            continue;
        };
        let bounds = MonitorBounds::from_monitor(monitor);
        let geometry = if settings.show_backdrop {
            backdrop_geometry(bounds)
        } else {
            card_geometry(bounds)
        };
        apply_geometry(&window, geometry);
        reveal(&window);
    }

    Ok(())
}

/// Wires the window subsystem. Windows are created on demand per break.
pub fn init<R: Runtime>(_app: &AppHandle<R>) -> AppResult<()> {
    Ok(())
}

fn label_for(index: usize) -> String {
    format!("{BREAK_WINDOW_PREFIX}{index}")
}

/// Enumerates the connected monitors through an existing window.
///
/// `available_monitors` lives on windows, not on `AppHandle`; the settings
/// window is always present and serves as the enumeration anchor.
fn monitors<R: Runtime>(app: &AppHandle<R>) -> AppResult<Vec<tauri::Monitor>> {
    if let Some(window) = app.get_webview_window("main") {
        return Ok(window.available_monitors()?);
    }
    if let Some((_, window)) = app.webview_windows().into_iter().next() {
        return Ok(window.available_monitors()?);
    }
    Ok(Vec::new())
}

/// Creates one overlay window per monitor that does not have one yet.
fn ensure_windows<R: Runtime>(app: &AppHandle<R>) -> AppResult<()> {
    for (index, _monitor) in monitors(app)?.iter().enumerate() {
        let label = label_for(index);
        if app.get_webview_window(&label).is_some() {
            continue;
        }
        build_window(app, &label)?;
    }
    Ok(())
}

fn build_window<R: Runtime>(app: &AppHandle<R>, label: &str) -> AppResult<WebviewWindow<R>> {
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("BreakTimer")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .resizable(false)
        .shadow(false)
        .focusable(false)
        .visible(false)
        .build()?;

    // macOS ignores a later `set_focusable(false)` once the window has focus, so
    // make sure the flag is set before the window is ever shown.
    window.set_focusable(false)?;
    Ok(window)
}

fn apply_geometry<R: Runtime>(window: &WebviewWindow<R>, geometry: WindowGeometry) {
    let _ = window.set_size(PhysicalSize::new(geometry.width, geometry.height));
    let _ = window.set_position(PhysicalPosition::new(geometry.x, geometry.y));
}

fn reveal<R: Runtime>(window: &WebviewWindow<R>) {
    let _ = window.set_focusable(false);
    if let Err(error) = window.show() {
        eprintln!("failed to show break window: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn monitor() -> MonitorBounds {
        MonitorBounds {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            scale_factor: 1.0,
        }
    }

    #[test]
    fn prompt_bar_is_centred_near_the_top() {
        let geometry = prompt_geometry(monitor(), PROMPT_BASE_WIDTH);

        assert_eq!(geometry.width, 450);
        assert_eq!(geometry.height, 88);
        assert_eq!(geometry.x, (1920 - 450) / 2);
        assert_eq!(geometry.y, 48);
    }

    #[test]
    fn prompt_width_grows_with_enabled_actions() {
        let settings = Settings::default();
        assert_eq!(prompt_width(&settings), 500.0);

        let settings = Settings {
            skip_break_enabled: true,
            ..settings
        };
        assert_eq!(prompt_width(&settings), 570.0);
    }

    #[test]
    fn break_card_is_centred_at_roughly_500_by_300() {
        let geometry = card_geometry(monitor());

        assert_eq!(geometry.width, 500);
        assert_eq!(geometry.height, 300);
        assert_eq!(geometry.x, (1920 - 500) / 2);
        assert_eq!(geometry.y, (1080 - 300) / 2);
    }

    #[test]
    fn backdrop_covers_the_whole_monitor() {
        let geometry = backdrop_geometry(MonitorBounds {
            x: -1280,
            y: 0,
            width: 1280,
            height: 1024,
            scale_factor: 1.0,
        });

        assert_eq!(
            geometry,
            WindowGeometry {
                x: -1280,
                y: 0,
                width: 1280,
                height: 1024,
            }
        );
    }

    #[test]
    fn geometry_scales_with_the_monitor() {
        let geometry = prompt_geometry(
            MonitorBounds {
                scale_factor: 2.0,
                ..monitor()
            },
            500.0,
        );

        assert_eq!(geometry.width, 1000);
        assert_eq!(geometry.height, 176);
        assert_eq!(geometry.y, 96);
    }

    #[test]
    fn secondary_monitors_offset_the_geometry() {
        let geometry = card_geometry(MonitorBounds {
            x: 1920,
            y: 200,
            width: 1280,
            height: 1024,
            scale_factor: 1.0,
        });

        assert_eq!(geometry.x, 1920 + (1280 - 500) / 2);
        assert_eq!(geometry.y, 200 + (1024 - 300) / 2);
    }
}
