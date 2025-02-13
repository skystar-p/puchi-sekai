use std::sync::Mutex;

use tauri::Manager;

mod config;
mod handlers;

struct AppState {
    pub config: config::Config,
    pub model_data: Vec<u8>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // parse config from env
    let config = envy::prefixed("CONF_")
        .from_env::<config::Config>()
        .expect("error while parsing config from env");

    // read data from initial model path
    let model_data = std::fs::read(&config.initial_model_data_path)
        .expect("error while reading initial model data");

    tauri::Builder::default()
        .setup(|app| {
            // build app state
            let state = AppState { config, model_data };
            app.manage(Mutex::new(state));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![handlers::chat::chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
