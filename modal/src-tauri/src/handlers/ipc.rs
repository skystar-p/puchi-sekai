use puchi_sekai_common::IPCEvent;
use tauri::Manager;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("IPC error")]
    IPCError,
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
pub async fn send_chat(window: tauri::Window, content: String) -> Result<(), Error> {
    let socket_path = "ipc:///tmp/puchi-sekai";

    let event = IPCEvent::Chat { message: content };

    // Send the IPC message
    ipc_lib::send_ipc(&socket_path, event)
        .await
        .map_err(|_| Error::IPCError)?;

    // Exit the application
    window.app_handle().exit(0);

    Ok(())
}

// Command to exit the application
#[tauri::command]
pub fn exit_app(app_handle: tauri::AppHandle) {
    app_handle.exit(0);
}
