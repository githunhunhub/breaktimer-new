//! Local-only diagnostic logging (SPEC-0019).

use std::backtrace::Backtrace;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::panic;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, Once, OnceLock};

use chrono::Local;
use log::{Level, LevelFilter, Log, Metadata, Record};

const LOG_FILE_NAME: &str = "breaktimer-new.log";
const BACKUP_LOG_FILE_NAME: &str = "breaktimer-new.1.log";
const MAX_LOG_BYTES: u64 = 2 * 1024 * 1024;
const MAX_FRONTEND_MESSAGE_CHARS: usize = 4 * 1024;
const MAX_FRONTEND_STACK_CHARS: usize = 16 * 1024;
const LOG_TARGET_PREFIX: &str = "breaktimer_new_lib";

static LOGGER: OnceLock<DiagnosticLogger> = OnceLock::new();
static PANIC_HOOK: Once = Once::new();

struct DiagnosticLogger {
    writer: Mutex<Option<DiagnosticWriter>>,
}

impl Log for DiagnosticLogger {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        metadata.level() <= Level::Info && metadata.target().starts_with(LOG_TARGET_PREFIX)
    }

    fn log(&self, record: &Record<'_>) {
        if !self.enabled(record.metadata()) {
            return;
        }

        let message = record.args().to_string();
        eprintln!("[{}] {message}", record.level());
        if let Ok(mut writer) = self.writer.lock()
            && let Some(writer) = writer.as_mut()
        {
            let _ = writer.write_line(record.level().as_str(), &message);
        }
    }

    fn flush(&self) {
        if let Ok(mut writer) = self.writer.lock()
            && let Some(writer) = writer.as_mut()
            && let Some(file) = writer.file.as_mut()
        {
            let _ = file.flush();
        }
    }
}

/// Initializes local diagnostics. Failure falls back to stderr and never blocks
/// application startup (SPEC-0019).
pub(crate) fn init(logs_dir: &Path, portable: bool) {
    install_panic_hook();

    let writer = match DiagnosticWriter::open(logs_dir, MAX_LOG_BYTES) {
        Ok(writer) => Some(writer),
        Err(error) => {
            eprintln!(
                "failed to initialize diagnostic logs in {}: {error}",
                logs_dir.display()
            );
            None
        }
    };

    let logger = LOGGER.get_or_init(|| DiagnosticLogger {
        writer: Mutex::new(writer),
    });
    if log::set_logger(logger).is_ok() {
        log::set_max_level(LevelFilter::Info);
    }

    log::info!(
        target: "breaktimer_new_lib::diagnostics",
        "started version={} channel={} os={} arch={}",
        env!("CARGO_PKG_VERSION"),
        if portable { "portable" } else { "installer" },
        std::env::consts::OS,
        std::env::consts::ARCH
    );
}

pub(crate) fn log_frontend_error(message: &str, stack: &str) {
    let message = truncate(message, MAX_FRONTEND_MESSAGE_CHARS);
    let stack = truncate(stack, MAX_FRONTEND_STACK_CHARS);
    if stack.is_empty() {
        log::error!(
            target: "breaktimer_new_lib::frontend",
            "uncaught frontend error: {message}"
        );
    } else {
        log::error!(
            target: "breaktimer_new_lib::frontend",
            "uncaught frontend error: {message}\n{stack}"
        );
    }
}

fn truncate(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }

    let mut truncated: String = value.chars().take(max_chars).collect();
    truncated.push_str("\n[truncated]");
    truncated
}

fn install_panic_hook() {
    PANIC_HOOK.call_once(|| {
        let default_hook = panic::take_hook();
        panic::set_hook(Box::new(move |info| {
            let message = panic_message(info);
            let location = info
                .location()
                .map(|location| {
                    format!(
                        "{}:{}:{}",
                        location.file(),
                        location.line(),
                        location.column()
                    )
                })
                .unwrap_or_else(|| "unknown location".to_string());
            let backtrace = Backtrace::force_capture();
            log::error!(
                target: "breaktimer_new_lib::panic",
                "panic at {location}: {message}\n{backtrace}"
            );
            default_hook(info);
        }));
    });
}

fn panic_message(info: &panic::PanicHookInfo<'_>) -> String {
    if let Some(message) = info.payload().downcast_ref::<&str>() {
        (*message).to_string()
    } else if let Some(message) = info.payload().downcast_ref::<String>() {
        message.clone()
    } else {
        "non-string panic payload".to_string()
    }
}

pub(crate) struct DiagnosticWriter {
    path: PathBuf,
    backup_path: PathBuf,
    max_bytes: u64,
    bytes: u64,
    file: Option<File>,
}

impl DiagnosticWriter {
    pub(crate) fn open(directory: &Path, max_bytes: u64) -> io::Result<Self> {
        fs::create_dir_all(directory)?;
        let path = directory.join(LOG_FILE_NAME);
        let backup_path = directory.join(BACKUP_LOG_FILE_NAME);

        if file_size(&path).unwrap_or(0) >= max_bytes {
            rotate_files(&path, &backup_path)?;
        }

        let file = OpenOptions::new().create(true).append(true).open(&path)?;
        let bytes = file.metadata()?.len();

        Ok(Self {
            path,
            backup_path,
            max_bytes,
            bytes,
            file: Some(file),
        })
    }

    pub(crate) fn write_line(&mut self, level: &str, message: &str) -> io::Result<()> {
        let timestamp = Local::now().format("%Y-%m-%dT%H:%M:%S%.3f%:z");
        let line = format!("{timestamp} [{level}] {message}\n");

        if self.bytes > 0 && self.bytes.saturating_add(line.len() as u64) > self.max_bytes {
            self.rotate()?;
        }

        let file = self
            .file
            .as_mut()
            .ok_or_else(|| io::Error::other("diagnostic log file is unavailable"))?;
        file.write_all(line.as_bytes())?;
        file.flush()?;
        self.bytes = self.bytes.saturating_add(line.len() as u64);
        Ok(())
    }

    fn rotate(&mut self) -> io::Result<()> {
        let sync_result = self.file.take().map_or(Ok(()), |file| file.sync_all());
        let rotate_result = rotate_files(&self.path, &self.backup_path);
        let reopen_result = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path);

        match reopen_result {
            Ok(file) => {
                self.bytes = file.metadata().map(|metadata| metadata.len()).unwrap_or(0);
                self.file = Some(file);
            }
            Err(_) => {
                self.file = None;
                self.bytes = 0;
            }
        }

        sync_result?;
        rotate_result
    }
}

fn file_size(path: &Path) -> io::Result<u64> {
    fs::metadata(path).map(|metadata| metadata.len())
}

fn rotate_files(path: &Path, backup_path: &Path) -> io::Result<()> {
    if backup_path.exists() {
        fs::remove_file(backup_path)?;
    }
    if path.exists() {
        fs::rename(path, backup_path)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    use log::{Level, Record};

    use super::*;

    static NEXT_TEMP_ID: AtomicU64 = AtomicU64::new(0);

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new(name: &str) -> Self {
            let id = NEXT_TEMP_ID.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "breaktimer-new-diagnostics-{name}-{}-{id}",
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

    #[test]
    fn writes_a_level_and_message_to_the_current_log() {
        let directory = TestDirectory::new("write");
        let mut writer = DiagnosticWriter::open(directory.path(), 1024).unwrap();

        writer
            .write_line("ERROR", "window operation failed")
            .unwrap();
        drop(writer);

        let content = fs::read_to_string(directory.path().join("breaktimer-new.log")).unwrap();
        assert!(content.contains("[ERROR]"));
        assert!(content.contains("window operation failed"));
    }

    #[test]
    fn rotates_to_one_backup_when_the_current_log_is_full() {
        let directory = TestDirectory::new("rotate");
        let mut writer = DiagnosticWriter::open(directory.path(), 1).unwrap();

        writer.write_line("INFO", "first record").unwrap();
        writer.write_line("ERROR", "second record").unwrap();
        drop(writer);

        let current = fs::read_to_string(directory.path().join("breaktimer-new.log")).unwrap();
        let backup = fs::read_to_string(directory.path().join("breaktimer-new.1.log")).unwrap();
        assert!(current.contains("second record"));
        assert!(!current.contains("first record"));
        assert!(backup.contains("first record"));
    }

    #[test]
    fn logger_writes_backend_records_through_the_log_facade() {
        let directory = TestDirectory::new("logger");
        let writer = DiagnosticWriter::open(directory.path(), 1024).unwrap();
        let logger = DiagnosticLogger {
            writer: Mutex::new(Some(writer)),
        };

        logger.log(
            &Record::builder()
                .level(Level::Error)
                .target("breaktimer_new_lib::test")
                .args(format_args!("backend operation failed"))
                .build(),
        );
        logger.flush();
        drop(logger);

        let content = fs::read_to_string(directory.path().join("breaktimer-new.log")).unwrap();
        assert!(content.contains("[ERROR]"));
        assert!(content.contains("backend operation failed"));
    }
}
