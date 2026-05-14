use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize)]
pub struct ScreenshotResult {
    pub success: bool,
    pub data_base64: Option<String>,
    pub size_bytes: Option<u64>,
    pub timestamp_ms: u64,
}

/// Captures an activity snapshot only when the user has explicitly opted in.
/// The `enabled` flag is controlled by the user's settings toggle — if false,
/// no capture is attempted and the command returns immediately.
#[tauri::command]
pub async fn capture_screenshot(enabled: bool) -> Result<ScreenshotResult, String> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    if !enabled {
        return Ok(ScreenshotResult {
            success: false,
            data_base64: None,
            size_bytes: None,
            timestamp_ms: now_ms,
        });
    }

    // Platform-specific capture would be implemented here.
    // Target: compressed JPEG at ~20KB resolution for bandwidth efficiency.
    // On Linux: xcb/X11 or pipewire screenshot portal.
    // On macOS: CGDisplay capture.
    // On Windows: GDI/DXGI desktop duplication.
    // The result is base64-encoded and returned to the frontend sync queue.
    Ok(ScreenshotResult {
        success: false,
        data_base64: None,
        size_bytes: None,
        timestamp_ms: now_ms,
    })
}
