use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Serialize, Deserialize, Clone)]
pub struct ActivitySnapshot {
    pub keystroke_count: u64,
    pub mouse_event_count: u64,
    pub window_focus_seconds: u64,
    pub timestamp_ms: u64,
    pub packet_duration_seconds: u64,
}

#[derive(Serialize, Deserialize)]
pub struct ActivityPacket {
    pub session_id: String,
    pub user_id: String,
    pub keystroke_count: u64,
    pub mouse_event_count: u64,
    pub window_focus_seconds: u64,
    pub recorded_at: String,
    pub packet_duration_seconds: u64,
}

#[tauri::command]
pub async fn get_activity_snapshot() -> Result<ActivitySnapshot, String> {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    // In production: read from MonitoringState shared state.
    // Frontend's own DOM listeners handle this in the browser context.
    Ok(ActivitySnapshot {
        keystroke_count: 0,
        mouse_event_count: 0,
        window_focus_seconds: 0,
        timestamp_ms: now_ms,
        packet_duration_seconds: 60,
    })
}

#[tauri::command]
pub async fn get_timestamp_ms() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .map_err(|e| e.to_string())
}
