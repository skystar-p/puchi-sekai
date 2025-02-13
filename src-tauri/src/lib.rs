use std::sync::Mutex;

use tauri::Manager;

mod handlers;

#[derive(Default)]
struct AppState {
    pub model_data: Vec<u8>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(Mutex::new(AppState::default()));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![handlers::chat::chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
