//! Break sound playback (SPEC-0009).
//!
//! Sounds are embedded into the binary and played from a detached thread so a
//! missing or broken audio device can never block the scheduler (ADR-0003).
//! `SoundType::None` is silent.

use tauri::{AppHandle, Runtime};

use crate::error::AppResult;
use crate::state::{Settings, SoundType};

/// Wires the sound subsystem. Playback is entirely on demand, so this is a
/// no-op kept for symmetry with the other subsystems.
pub fn init<R: Runtime>(_app: &AppHandle<R>) -> AppResult<()> {
    Ok(())
}

/// Plays the start or end sound for the configured [`SoundType`].
///
/// Returns immediately; the actual playback happens on a background thread.
pub fn play(settings: &Settings, is_start: bool) {
    let Some(bytes) = sound_bytes(settings.sound_type, is_start) else {
        return;
    };
    let volume = settings.break_sound_volume.clamp(0.0, 1.0);

    std::thread::spawn(move || {
        if let Err(error) = play_blocking(bytes, volume) {
            eprintln!("failed to play break sound: {error}");
        }
    });
}

/// Plays the start sound for a settings preview button (SPEC-0010).
///
/// The settings window previews the currently selected sound before saving, so
/// this takes the candidate values instead of reading the stored settings.
pub fn play_preview(sound_type: SoundType, volume: f32) {
    let settings = Settings {
        sound_type,
        break_sound_volume: volume,
        ..Settings::default()
    };
    play(&settings, true);
}

/// Maps a sound type and break phase to the embedded WAV bytes.
fn sound_bytes(sound_type: SoundType, is_start: bool) -> Option<&'static [u8]> {
    let bytes: &'static [u8] = match (sound_type, is_start) {
        (SoundType::Gong, true) => include_bytes!("../../sounds/gong_start.wav"),
        (SoundType::Gong, false) => include_bytes!("../../sounds/gong_end.wav"),
        (SoundType::Blip, true) => include_bytes!("../../sounds/blip_start.wav"),
        (SoundType::Blip, false) => include_bytes!("../../sounds/blip_end.wav"),
        (SoundType::Bloop, true) => include_bytes!("../../sounds/bloop_start.wav"),
        (SoundType::Bloop, false) => include_bytes!("../../sounds/bloop_end.wav"),
        (SoundType::Ping, true) => include_bytes!("../../sounds/ping_start.wav"),
        (SoundType::Ping, false) => include_bytes!("../../sounds/ping_end.wav"),
        (SoundType::Scifi, true) => include_bytes!("../../sounds/scifi_start.wav"),
        (SoundType::Scifi, false) => include_bytes!("../../sounds/scifi_end.wav"),
        (SoundType::None, _) => return None,
    };
    Some(bytes)
}

fn play_blocking(bytes: &'static [u8], volume: f32) -> Result<(), String> {
    use rodio::{Decoder, OutputStream, Sink};

    let (_stream, handle) =
        OutputStream::try_default().map_err(|error| format!("audio output: {error}"))?;
    let sink = Sink::try_new(&handle).map_err(|error| format!("audio sink: {error}"))?;
    let source = Decoder::new(std::io::Cursor::new(bytes))
        .map_err(|error| format!("decode wav: {error}"))?;

    sink.set_volume(volume);
    sink.append(source);
    sink.sleep_until_end();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn none_is_silent_for_both_phases() {
        assert!(sound_bytes(SoundType::None, true).is_none());
        assert!(sound_bytes(SoundType::None, false).is_none());
    }

    #[test]
    fn every_named_sound_has_start_and_end_bytes() {
        for sound_type in [
            SoundType::Gong,
            SoundType::Blip,
            SoundType::Bloop,
            SoundType::Ping,
            SoundType::Scifi,
        ] {
            let start = sound_bytes(sound_type, true).expect("start bytes");
            let end = sound_bytes(sound_type, false).expect("end bytes");
            assert!(start.len() > 44, "start clip should have audio data");
            assert!(end.len() > 44, "end clip should have audio data");
            assert_ne!(start, end, "start and end clips should differ");
        }
    }
}
