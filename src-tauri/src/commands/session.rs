use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tauri::State;

pub struct MonitoringState {
    pub is_active: AtomicBool,
    pub keystroke_count: AtomicU64,
    pub mouse_event_count: AtomicU64,
    pub session_start_ms: AtomicU64,
}

impl MonitoringState {
    pub fn new() -> Self {
        Self {
            is_active: AtomicBool::new(false),
            keystroke_count: AtomicU64::new(0),
            mouse_event_count: AtomicU64::new(0),
            session_start_ms: AtomicU64::new(0),
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct SessionStats {
    pub is_active: bool,
    pub elapsed_seconds: u64,
    pub keystroke_count: u64,
    pub mouse_event_count: u64,
}

#[tauri::command]
pub async fn start_monitoring() -> Result<bool, String> {
    // In a real implementation this would wire up OS-level event listeners.
    // For now, we signal success — the frontend handles its own counters
    // via DOM event listeners (keydown / mousemove) that are transparent to the user.
    Ok(true)
}

#[tauri::command]
pub async fn stop_monitoring() -> Result<bool, String> {
    Ok(true)
}

#[tauri::command]
pub async fn get_session_stats() -> Result<SessionStats, String> {
    Ok(SessionStats {
        is_active: false,
        elapsed_seconds: 0,
        keystroke_count: 0,
        mouse_event_count: 0,
    })
}
