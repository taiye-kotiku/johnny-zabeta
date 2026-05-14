use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ScreenshotResult {
    pub success: bool,
    pub data_base64: Option<String>,
    pub size_bytes: Option<u64>,
    pub timestamp_ms: u64,
}

/// Captures a low-resolution activity snapshot (user-consented, toggle-controlled).
/// Only called when the user has explicitly enabled snapshots in their settings.
#[tauri::command]
pub async fn capture_screenshot(enabled: bool) -> Result<ScreenshotResult, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    if !enabled {
        return Ok(ScreenshotResult {
            success: false,
            data_base64: None,
            size_bytes: None,
            timestamp_ms: now,
        });
    }

    // Actual screen capture would be implemented here using platform-specific
    // APIs (e.g., xcb on Linux, CGDisplay on macOS, GDI on Windows).
    // Returns a compressed low-resolution JPEG (~20KB target).
    Ok(ScreenshotResult {
        success: false,
        data_base64: None,
        size_bytes: None,
        timestamp_ms: now,
    })
}
