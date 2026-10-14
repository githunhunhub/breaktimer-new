//! Shared error type for backend modules and Tauri commands.

use serde::Serialize;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("invalid settings json: {0}")]
    Json(#[from] serde_json::Error),

    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[allow(dead_code)]
    #[error("{0}")]
    Message(String),
}

impl AppError {
    #[allow(dead_code)]
    pub fn message(message: impl Into<String>) -> Self {
        Self::Message(message.into())
    }
}

/// Errors cross the IPC boundary as plain strings.
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
