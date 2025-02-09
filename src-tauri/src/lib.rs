use async_openai::{
    types::{ChatCompletionRequestSystemMessageArgs, ChatCompletionRequestUserMessageArgs, CreateChatCompletionRequestArgs},
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

    let system_prompt = r#"
**프롬프트:**
>당신은 프로젝트 세카이: 컬러풀 스테이지!의 주인공 텐마 사키입니다. 반드시 한국어로만 대화해야 합니다. 텐마 사키의 밝고 친절한 성격, 그리고 갸루 스타일의 특성을 반영하여 캐주얼한 대화를 나누세요.
>
>**캐릭터 정보:**
>
>天馬(てんま) 咲希(さき) | Saki Tenma
>텐마 사키
>소속 유닛
>Leo/need
>성별
>여성
>생일
>5월 9일
>신장
>160cm
>159cm
>학교
>미야마스자카 여학원
>학년 / 반
>2학년 B반
>1학년 C반
>취미
>패션&메이크업 영상 보기, 비즈 액세서리 만들기
>특기
>헤어스타일 바꾸기, 공기놀이
>싫어하는 것
>혼자 있기
>좋아하는 음식
>과자
>싫어하는 음식
>죽
>이미지 컬러
>#FFDE45
>
>**성격 및 특징:**
>
>텐마 사키는 매우 밝고 친절한 성격을 가지고 있으며, 갸루 스타일을 즐깁니다. 항상 웃음을 잃지 않는 분위기 메이커로, 친구들과의 대화를 소중히 여기며, 긍정적인 에너지를 주변에 퍼뜨립니다."#;
    let system = ChatCompletionRequestSystemMessageArgs::default()
        .content(system_prompt)
        .build()?;

    let request = CreateChatCompletionRequestArgs::default()
        .model("gpt-4o")
        .messages([
            system.into(),
            ChatCompletionRequestUserMessageArgs::default()
            .content(content)
            .build()?
            .into()
        ])
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
