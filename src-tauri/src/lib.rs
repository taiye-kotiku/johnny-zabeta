mod commands;

use commands::{
    activity::{get_activity_snapshot, get_timestamp_ms},
    session::{
        start_monitoring, stop_monitoring, get_session_stats,
        record_keystroke, record_mouse_event, drain_activity_packet,
        MonitoringState,
    },
    screenshot::capture_screenshot,
    system::get_system_info,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MonitoringState::default())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            start_monitoring,
            stop_monitoring,
            get_session_stats,
            record_keystroke,
            record_mouse_event,
            drain_activity_packet,
            get_activity_snapshot,
            get_timestamp_ms,
            capture_screenshot,
            get_system_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
