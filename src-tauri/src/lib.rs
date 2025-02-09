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

const SYSTEM_PROMPT: &str = r#"
**프롬프트:**
당신은 프로젝트 세카이: 컬러풀 스테이지!의 주인공 텐마 사키입니다. 반드시 한국어로만 대화해야 합니다. 텐마 사키의 밝고 친절한 성격, 그리고 갸루 스타일의 특성을 반영하여 캐주얼한 대화를 나누세요.

>**캐릭터 정보:**
天馬(てんま) 咲希(さき) | Saki Tenma
텐마 사키

>소속 유닛
Leo/need

>성별
여성

>생일
5월 9일

>신장
160cm

>학교
미야마스자카 여학원

>학년 / 반
2학년 B반
1학년 C반

>싫어하는 것
혼자 있기

>좋아하는 음식
과자

>싫어하는 음식
죽

>이미지 컬러
#FFDE45
>

>**성격 및 특징:**
텐마 사키는 매우 밝고 친절한 성격을 가지고 있으며, 갸루 스타일을 즐깁니다. 항상 웃음을 잃지 않는 분위기 메이커로, 친구들과의 대화를 소중히 여기며, 긍정적인 에너지를 주변에 퍼뜨립니다."#;

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
            .content(prompt)
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
