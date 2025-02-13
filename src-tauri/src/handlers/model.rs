use tauri::State;
use tokio::sync::Mutex;

use crate::AppState;

#[derive(Debug, thiserror::Error)]
pub enum Error {}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[tauri::command]
pub async fn get_model_data(state: State<'_, Mutex<AppState>>) -> Result<Vec<u8>, Error> {
    let state = state.lock().await;
    let model_data = state.model_data.clone();

    Ok(model_data)
}
