//! Runtime data paths and portable-mode detection (SPEC-0012).

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

pub const PORTABLE_FLAG_FILE: &str = "portable.flag";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppPaths {
    pub portable: bool,
    pub settings_path: PathBuf,
    pub webview2_dir: PathBuf,
}

#[derive(Debug, thiserror::Error)]
pub enum AppPathError {
    #[error("cannot determine the application directory from {0}")]
    MissingExecutableDirectory(PathBuf),

    #[error("failed to prepare data directory {path}: {source}")]
    PrepareDirectory {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("portable data directory is not writable: {path}")]
    PortableDataUnavailable {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
}

pub fn prepare(
    executable: &Path,
    config_dir: &Path,
    local_data_dir: &Path,
) -> Result<AppPaths, AppPathError> {
    let app_dir = executable
        .parent()
        .ok_or_else(|| AppPathError::MissingExecutableDirectory(executable.to_path_buf()))?;
    let portable = fs::metadata(app_dir.join(PORTABLE_FLAG_FILE))
        .map(|metadata| metadata.is_file())
        .unwrap_or(false);

    if !portable {
        return Ok(AppPaths {
            portable,
            settings_path: config_dir.join("settings.json"),
            webview2_dir: local_data_dir.to_path_buf(),
        });
    }

    let data_dir = app_dir.join("data");
    let webview2_dir = data_dir.join("webview2");
    create_directory(&data_dir)?;
    create_directory(&webview2_dir)?;
    verify_writable(&data_dir)?;

    Ok(AppPaths {
        portable,
        settings_path: data_dir.join("settings.json"),
        webview2_dir,
    })
}

fn create_directory(path: &Path) -> Result<(), AppPathError> {
    fs::create_dir_all(path).map_err(|source| AppPathError::PrepareDirectory {
        path: path.to_path_buf(),
        source,
    })
}

fn verify_writable(data_dir: &Path) -> Result<(), AppPathError> {
    let probe_path = data_dir.join(format!(".write-probe-{}", std::process::id()));
    let result = (|| {
        let mut probe = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&probe_path)?;
        probe.write_all(b"breaktimer")?;
        probe.flush()
    })();

    let _ = fs::remove_file(&probe_path);
    result.map_err(|source| AppPathError::PortableDataUnavailable {
        path: data_dir.to_path_buf(),
        source,
    })
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::*;

    static NEXT_TEMP_ID: AtomicU64 = AtomicU64::new(0);

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new(name: &str) -> Self {
            let id = NEXT_TEMP_ID.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "breaktimer-paths-{name}-{}-{id}",
                std::process::id()
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn executable_in(directory: &Path) -> PathBuf {
        let app_dir = directory.join("BreakTimer");
        fs::create_dir_all(&app_dir).unwrap();
        app_dir.join("breaktimer.exe")
    }

    #[test]
    fn installed_app_uses_appdata_directories() {
        let root = TestDirectory::new("installed");
        let executable = executable_in(root.path());
        let config_dir = root.path().join("config");
        let local_data_dir = root.path().join("local-data");

        let paths = prepare(&executable, &config_dir, &local_data_dir).unwrap();

        assert!(!paths.portable);
        assert_eq!(paths.settings_path, config_dir.join("settings.json"));
        assert_eq!(paths.webview2_dir, local_data_dir);
    }

    #[test]
    fn portable_flag_moves_settings_and_webview_data_under_the_program() {
        let root = TestDirectory::new("portable");
        let executable = executable_in(root.path());
        let app_dir = executable.parent().unwrap();
        fs::write(app_dir.join(PORTABLE_FLAG_FILE), []).unwrap();

        let paths = prepare(
            &executable,
            &root.path().join("ignored-config"),
            &root.path().join("ignored-local-data"),
        )
        .unwrap();

        assert!(paths.portable);
        assert_eq!(
            paths.settings_path,
            app_dir.join("data").join("settings.json")
        );
        assert_eq!(paths.webview2_dir, app_dir.join("data").join("webview2"));
    }

    #[test]
    fn a_directory_named_like_the_flag_does_not_enable_portable_mode() {
        let root = TestDirectory::new("flag-directory");
        let executable = executable_in(root.path());
        let app_dir = executable.parent().unwrap();
        fs::create_dir_all(app_dir.join(PORTABLE_FLAG_FILE)).unwrap();
        let config_dir = root.path().join("config");
        let local_data_dir = root.path().join("local-data");

        let paths = prepare(&executable, &config_dir, &local_data_dir).unwrap();

        assert!(!paths.portable);
        assert_eq!(paths.settings_path, config_dir.join("settings.json"));
        assert_eq!(paths.webview2_dir, local_data_dir);
    }

    #[test]
    fn unusable_portable_data_directory_returns_the_blocked_path() {
        let root = TestDirectory::new("unwritable");
        let executable = executable_in(root.path());
        let app_dir = executable.parent().unwrap();
        fs::write(app_dir.join(PORTABLE_FLAG_FILE), []).unwrap();
        fs::write(app_dir.join("data"), []).unwrap();

        let error = prepare(
            &executable,
            &root.path().join("config"),
            &root.path().join("local-data"),
        )
        .unwrap_err();

        assert!(matches!(
            error,
            AppPathError::PrepareDirectory { ref path, .. }
                if path == &app_dir.join("data")
        ));
    }
}
