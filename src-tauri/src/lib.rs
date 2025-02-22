use std::sync::Arc;

use base64::{prelude::BASE64_STANDARD, Engine};
use gtk::{
    cairo,
    glib::MainContext,
    prelude::{ContainerExt, GtkWindowExt, WidgetExt},
};
use gtk_layer_shell::LayerShell;
use puchi_sekai_common::IPCEvent;
use tauri::{Emitter, Listener, Manager};
use tokio::sync::Mutex;
use tracing::{debug, error};
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
                        error!("Error while converting message into string: {:?}", e);
                        continue;
                    }
                },
                Err(e) => {
                    error!("Error while receiving message: {:?}", e);
                    continue;
                }
            };
            debug!("Received message: {:?}", received);
            let msg: IPCEvent = match serde_json::from_str(&received) {
                Ok(msg) => msg,
                Err(e) => {
                    error!("Error while parsing message: {:?}", e);
                    continue;
                }
            };
            let _ = app_handle.emit("ipc", msg);
        }
    });

    // make window surface as layer shell
    let main_window = app.get_webview_window("main").unwrap();
    main_window.hide()?;

    let gtk_window = gtk::ApplicationWindow::new(&main_window.gtk_window()?.application().unwrap());

    // prevent initial black window
    gtk_window.set_app_paintable(true);

    // migrate vbox to new layer shell window
    let vbox = main_window.default_vbox().unwrap();
    main_window.gtk_window().unwrap().remove(&vbox);
    gtk_window.add(&vbox);

    // init
    gtk_window.init_layer_shell();

    // set layer
    gtk_window.set_layer(gtk_layer_shell::Layer::Top);

    // anchor it to bottom-right
    gtk_window.set_anchor(gtk_layer_shell::Edge::Right, true);
    gtk_window.set_anchor(gtk_layer_shell::Edge::Bottom, true);

    // set size
    gtk_window.set_width_request(300);
    gtk_window.set_height_request(650);

    // show window first to find actual window
    gtk_window.show_all();

    // make click-through
    if let Some(gdk_window) = gtk_window.window() {
        gdk_window.input_shape_combine_region(&cairo::Region::create(), 0, 0);
    } else {
        error!("error: cannot get gdk window to make click-through");
    }

    let gtk_window = Arc::new(Mutex::new(gtk_window));

    let (ipc_sender, ipc_receiver) = tokio::sync::mpsc::channel::<tauri::Event>(100);

    let app_handle = app.handle().clone();
    MainContext::default().spawn_local(async move {
        let gtk_window = gtk_window.clone();
        let mut receiver = ipc_receiver;
        loop {
            let msg = match receiver.recv().await {
                Some(msg) => msg,
                None => return (),
            };

            let event: IPCEvent = if let Ok(event) = serde_json::from_str(msg.payload()) {
                event
            } else {
                continue;
            };

            match event {
                IPCEvent::MainToggle => {
                    let gtk_window = gtk_window.lock().await;
                    if gtk_window.is_visible() {
                        gtk_window.hide();
                    } else {
                        gtk_window.show();
                    }
                }

                IPCEvent::OpenModal => {
                    if app_handle.get_webview_window("modal").is_some() {
                        continue;
                    }

                    // second window
                    let modal_window = tauri::WebviewWindowBuilder::new(
                        &app_handle,
                        "modal",
                        tauri::WebviewUrl::App("index-modal.html".into()),
                    )
                    .build()
                    .unwrap();
                    modal_window.center().unwrap();
                    modal_window.set_decorations(false).unwrap();
                    modal_window.hide().unwrap();

                    // tauri on linux has a bug where the window is not resizable
                    // so migrate vbox to new application window, and manually set size at it
                    let model_gtk_window = gtk::ApplicationWindow::new(
                        &modal_window.gtk_window().unwrap().application().unwrap(),
                    );

                    // prevent initial black window
                    model_gtk_window.set_app_paintable(true);

                    // migrate vbox
                    let vbox = modal_window.default_vbox().unwrap();
                    modal_window.gtk_window().unwrap().remove(&vbox);
                    model_gtk_window.add(&vbox);

                    // set size
                    model_gtk_window.set_width_request(600);
                    model_gtk_window.set_height_request(600);

                    // show window
                    model_gtk_window.show_all();
                }
            }
        }
    });

    // setup ipc event listener
    app.listen("ipc", move |event| {
        debug!("Received IPC event: {:?}", event);

        let ipc_sender = ipc_sender.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let _ = ipc_sender.blocking_send(event);
        });
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
