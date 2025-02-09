use async_openai::{
    types::{ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs},
    Client,
};
use futures::StreamExt;
use serde::Serialize;
use tauri::ipc::Channel;

#[derive(Debug, thiserror::Error)]
enum Error {
    #[error("OpenAI error: {0}")]
    OpenAIError(#[from] async_openai::error::OpenAIError),
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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
enum ChatEvent {
    #[serde(rename_all = "camelCase")]
    Started {},
    #[serde(rename_all = "camelCase")]
    Response { content: String },
    #[serde(rename_all = "camelCase")]
    Finished {},
    #[serde(rename_all = "camelCase")]
    Error { message: String },
}

#[tauri::command]
async fn chat(content: String, on_event: Channel<ChatEvent>) -> Result<(), Error> {
    let client = Client::new();

    let request = CreateChatCompletionRequestArgs::default()
        .model("gpt-4o")
        .messages([ChatCompletionRequestUserMessageArgs::default()
            .content(content)
            .build()?
            .into()])
        .build()?;

    let mut stream = client.chat().create_stream(request).await?;

    {
        let event = ChatEvent::Started {};
        on_event.send(event)?;
    }

    while let Some(result) = stream.next().await {
        let result = match result {
            Ok(result) => result,
            Err(err) => {
                let event = ChatEvent::Error {
                    message: err.to_string(),
                };

                on_event.send(event)?;
                return Err(err.into());
            }
        };

        result.choices.iter().for_each(|chat_choice| {
            if let Some(ref content) = chat_choice.delta.content {
                let event = ChatEvent::Response {
                    content: content.clone(),
                };

                on_event.send(event).unwrap();
            }
        });
    }

    {
        let event = ChatEvent::Finished {};
        on_event.send(event)?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![chat])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
