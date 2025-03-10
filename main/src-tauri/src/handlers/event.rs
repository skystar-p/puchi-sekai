use std::sync::Mutex;

use futures::StreamExt;
use serde::Serialize;
use tauri::{ipc::Channel, Manager};

use crate::AppState;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum Event {
    #[serde(rename_all = "camelCase")]
    ModelData { data: Vec<u8> },
}

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Tauri error: {0}")]
    TauriError(#[from] tauri::Error),
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
pub async fn subscribe_event(app: tauri::AppHandle, on_event: Channel<Event>) -> Result<(), Error> {
    let state = app.state::<Mutex<AppState>>();

    let mut state = state.lock().unwrap();

    unimplemented!()
}
