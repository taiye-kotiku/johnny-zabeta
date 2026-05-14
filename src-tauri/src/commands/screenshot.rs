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
/// The `enabled` flag is controlled by the user's settings toggle.
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

    use base64::{engine::general_purpose, Engine as _};
    use screenshots::Screen;

    let screens = Screen::all().map_err(|e| e.to_string())?;
    let screen = screens.first().ok_or_else(|| "No screens available".to_string())?;
    let image = screen.capture().map_err(|e| e.to_string())?;

    let png_bytes = image.to_png(None).map_err(|e| e.to_string())?;
    let size = png_bytes.len() as u64;
    let encoded = general_purpose::STANDARD.encode(&png_bytes);

    Ok(ScreenshotResult {
        success: true,
        data_base64: Some(format!("data:image/png;base64,{}", encoded)),
        size_bytes: Some(size),
        timestamp_ms: now_ms,
    })
}
