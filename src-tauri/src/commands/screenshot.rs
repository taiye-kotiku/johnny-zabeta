use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

#[derive(Serialize, Deserialize)]
pub struct ScreenshotResult {
    pub success: bool,
    pub data_base64: Option<String>,
    pub size_bytes: Option<u64>,
    pub timestamp_ms: u64,
}

/// Captures the app window as an activity snapshot, only when the user has
/// explicitly opted in via the settings toggle. Uses Tauri's built-in
/// WebviewWindow capture — no external system library dependencies beyond
/// what Tauri already requires.
#[tauri::command]
pub async fn capture_screenshot(app: AppHandle, enabled: bool) -> Result<ScreenshotResult, String> {
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
    use image::{codecs::png::PngEncoder, ImageBuffer, ImageEncoder, Rgba};

    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;

    let img = window.capture_image().map_err(|e| e.to_string())?;
    let (width, height) = (img.width(), img.height());

    let buffer = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_raw(width, height, img.rgba().to_vec())
        .ok_or_else(|| "Failed to build image buffer".to_string())?;

    let mut png_bytes: Vec<u8> = Vec::new();
    PngEncoder::new(&mut png_bytes)
        .write_image(
            buffer.as_raw(),
            width,
            height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|e| e.to_string())?;

    let size = png_bytes.len() as u64;
    let encoded = general_purpose::STANDARD.encode(&png_bytes);

    Ok(ScreenshotResult {
        success: true,
        data_base64: Some(format!("data:image/png;base64,{}", encoded)),
        size_bytes: Some(size),
        timestamp_ms: now_ms,
    })
}
