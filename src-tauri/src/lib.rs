use base64::{prelude::BASE64_STANDARD, Engine};
use puchi_sekai_common::IPCEvent;
use tauri::{Emitter, Listener, Manager};
use tokio::sync::Mutex;
use zeromq::{Socket, SocketRecv};

mod config;
mod handlers;

struct AppState {
    pub config: config::Config,
    pub model_data_b64: String,
    pub system_prompt: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(setup)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            handlers::chat::chat,
            handlers::model::get_model_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup<'a>(app: &'a mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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

    // setup zeromq listener
    let socket_addr = config.ipc_socket_address.clone();
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        let mut socket = zeromq::RepSocket::new();
        let file_path = socket_addr.trim_start_matches("ipc://");
        let _ = tokio::fs::remove_file(&file_path).await;
        let _ = socket.bind(&socket_addr).await;

        loop {
            let received: String = match socket.recv().await {
                Ok(r) => match r.try_into() {
                    Ok(r) => r,
                    Err(e) => {
                        eprintln!("Error while converting message into string: {:?}", e);
                        continue;
                    }
                },
                Err(e) => {
                    eprintln!("Error while receiving message: {:?}", e);
                    continue;
                }
            };
            println!("Received message: {:?}", received);
            let msg: IPCEvent = match serde_json::from_str(&received) {
                Ok(msg) => msg,
                Err(e) => {
                    eprintln!("Error while parsing message: {:?}", e);
                    continue;
                }
            };
            let _ = app_handle.emit("ipc", msg);
        }
    });

    // setup ipc event listener
    let app_handle = app.handle().clone();
    app.listen("ipc", move |event| {
        println!("Received IPC event: {:?}", event);

        for (_, window) in app_handle.webview_windows() {
            if window.is_visible().unwrap() {
                let _ = window.hide();
            } else {
                let _ = window.show();
            }
        }
    });

    // build app state
    let state = AppState {
        config,
        model_data_b64,
        system_prompt,
    };
    app.manage(Mutex::new(state));

    Ok(())
}
