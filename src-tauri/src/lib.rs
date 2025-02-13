use base64::{prelude::BASE64_STANDARD, Engine};
use tauri::Manager;
use tokio::sync::Mutex;

mod config;
mod handlers;

struct AppState {
    pub config: config::Config,
    pub model_data_b64: String,
    pub system_prompt: String,
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
    let model_data_b64 = BASE64_STANDARD.encode(&model_data);

    // read system prompt
    let system_prompt = std::fs::read_to_string(&config.system_prompt_file_path)
        .expect("error while reading system prompt");

    tauri::Builder::default()
        .setup(|app| {
            // build app state
            let state = AppState {
                config,
                model_data_b64,
                system_prompt,
            };
            app.manage(Mutex::new(state));
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![handlers::chat::chat, handlers::model::get_model_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
