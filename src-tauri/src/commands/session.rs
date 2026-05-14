use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::State;

pub struct MonitoringState {
    pub is_active: AtomicBool,
    pub keystroke_count: AtomicU64,
    pub mouse_event_count: AtomicU64,
    pub focus_seconds: AtomicU64,
    pub start_timestamp_ms: AtomicU64,
    pub current_session_id: Mutex<Option<String>>,
}

impl Default for MonitoringState {
    fn default() -> Self {
        Self {
            is_active: AtomicBool::new(false),
            keystroke_count: AtomicU64::new(0),
            mouse_event_count: AtomicU64::new(0),
            focus_seconds: AtomicU64::new(0),
            start_timestamp_ms: AtomicU64::new(0),
            current_session_id: Mutex::new(None),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionStats {
    pub is_active: bool,
    pub elapsed_seconds: u64,
    pub keystroke_count: u64,
    pub mouse_event_count: u64,
    pub focus_seconds: u64,
    pub session_id: Option<String>,
}

#[tauri::command]
pub async fn start_monitoring(
    session_id: String,
    state: State<'_, MonitoringState>,
) -> Result<bool, String> {
    if state.is_active.load(Ordering::SeqCst) {
        return Err("Monitoring already active".into());
    }

    state.keystroke_count.store(0, Ordering::SeqCst);
    state.mouse_event_count.store(0, Ordering::SeqCst);
    state.focus_seconds.store(0, Ordering::SeqCst);

    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;

    state.start_timestamp_ms.store(now_ms, Ordering::SeqCst);
    *state.current_session_id.lock().unwrap() = Some(session_id);
    state.is_active.store(true, Ordering::SeqCst);

    Ok(true)
}

#[tauri::command]
pub async fn stop_monitoring(
    state: State<'_, MonitoringState>,
) -> Result<SessionStats, String> {
    let stats = build_stats(&state)?;
    state.is_active.store(false, Ordering::SeqCst);
    *state.current_session_id.lock().unwrap() = None;
    state.keystroke_count.store(0, Ordering::SeqCst);
    state.mouse_event_count.store(0, Ordering::SeqCst);
    state.focus_seconds.store(0, Ordering::SeqCst);
    Ok(stats)
}

#[tauri::command]
pub async fn get_session_stats(
    state: State<'_, MonitoringState>,
) -> Result<SessionStats, String> {
    build_stats(&state)
}

#[tauri::command]
pub async fn record_keystroke(state: State<'_, MonitoringState>) -> Result<(), String> {
    if state.is_active.load(Ordering::SeqCst) {
        state.keystroke_count.fetch_add(1, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub async fn record_mouse_event(state: State<'_, MonitoringState>) -> Result<(), String> {
    if state.is_active.load(Ordering::SeqCst) {
        state.mouse_event_count.fetch_add(1, Ordering::Relaxed);
    }
    Ok(())
}

#[tauri::command]
pub async fn drain_activity_packet(
    state: State<'_, MonitoringState>,
) -> Result<SessionStats, String> {
    let stats = build_stats(&state)?;
    // Reset counters after draining (packet flushed to backend)
    state.keystroke_count.store(0, Ordering::SeqCst);
    state.mouse_event_count.store(0, Ordering::SeqCst);
    state.focus_seconds.store(0, Ordering::SeqCst);
    Ok(stats)
}

fn build_stats(state: &MonitoringState) -> Result<SessionStats, String> {
    let is_active = state.is_active.load(Ordering::SeqCst);
    let elapsed_seconds = if is_active {
        let start = state.start_timestamp_ms.load(Ordering::SeqCst);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis() as u64;
        (now.saturating_sub(start)) / 1000
    } else {
        0
    };

    Ok(SessionStats {
        is_active,
        elapsed_seconds,
        keystroke_count: state.keystroke_count.load(Ordering::Relaxed),
        mouse_event_count: state.mouse_event_count.load(Ordering::Relaxed),
        focus_seconds: state.focus_seconds.load(Ordering::Relaxed),
        session_id: state.current_session_id.lock().unwrap().clone(),
    })
}
