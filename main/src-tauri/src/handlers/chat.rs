use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestAssistantMessageArgs, ChatCompletionRequestSystemMessageArgs,
        ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs,
    },
    Client,
};
use futures::StreamExt;
use serde::Serialize;
use tauri::{ipc::Channel, State};
use tokio::sync::Mutex;

use crate::AppState;

#[derive(Debug, thiserror::Error)]
pub enum Error {
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
pub enum Chat {
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
pub async fn chat(
    state: State<'_, Mutex<AppState>>,
    prompt: String,
    previous_prompts: Vec<String>,
    previous_responses: Vec<String>,
    on_event: Channel<Chat>,
) -> Result<(), Error> {
    let state = state.lock().await;
    let api_key = state.config.openai_api_key.clone();
    let system_prompt = state.system_prompt.clone();
    drop(state);

    let client_config = OpenAIConfig::new().with_api_key(api_key);
    let client = Client::with_config(client_config);

    // build message vec
    let system = ChatCompletionRequestSystemMessageArgs::default()
        .content(system_prompt)
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
        let event = Chat::Started {};
        on_event.send(event)?;
    }

    while let Some(result) = stream.next().await {
        let result = match result {
            Ok(result) => result,
            Err(err) => {
                let event = Chat::Error {
                    message: err.to_string(),
                };

                on_event.send(event)?;
                return Err(err.into());
            }
        };

        result.choices.iter().for_each(|chat_choice| {
            if let Some(ref content) = chat_choice.delta.content {
                let event = Chat::Response {
                    content: content.clone(),
                };

                on_event.send(event).unwrap();
            }
        });
    }

    {
        let event = Chat::Finished {};
        on_event.send(event)?;
    }

    Ok(())
}
