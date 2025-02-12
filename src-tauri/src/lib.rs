use async_openai::{
    types::{
        ChatCompletionRequestAssistantMessageArgs, ChatCompletionRequestSystemMessageArgs,
        ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs,
    },
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

const SYSTEM_PROMPT: &str = include_str!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/static/system_prompt.txt"
));

#[tauri::command]
async fn chat(
    prompt: String,
    previous_prompts: Vec<String>,
    previous_responses: Vec<String>,
    on_event: Channel<ChatEvent>,
) -> Result<(), Error> {
    let client = Client::new();

    // build message vec
    let system = ChatCompletionRequestSystemMessageArgs::default()
        .content(SYSTEM_PROMPT)
        .build()?;
    let mut messages = Vec::from([system.into()]);
    // zip
    previous_prompts
        .iter()
        .zip(previous_responses.iter())
        .for_each(|(content, response)| {
            messages.push(
                ChatCompletionRequestUserMessageArgs::default()
                    .content(content.clone())
                    .build()
                    .unwrap()
                    .into(),
            );
            messages.push(
                ChatCompletionRequestAssistantMessageArgs::default()
                    .content(response.clone())
                    .build()
                    .unwrap()
                    .into(),
            );
        });
    messages.push(
        ChatCompletionRequestUserMessageArgs::default()
            .content(format!("<user_input>{}</user_input>", prompt))
            .build()?
            .into(),
    );

    let request = CreateChatCompletionRequestArgs::default()
        .model("gpt-4o")
        .messages(messages)
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
