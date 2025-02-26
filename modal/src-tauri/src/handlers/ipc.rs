use puchi_sekai_common::IPCEvent;
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
pub async fn send_chat(content: String) -> Result<(), Error> {
    let socket_path = "ipc:///tmp/puchi-sekai";

    let event = IPCEvent::Chat { message: content };

    ipc_lib::send_ipc(&socket_path, event)
        .await
        .map_err(|_| Error::IPCError)?;

    Ok(())
}
