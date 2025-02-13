use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    #[serde(default = "default_initial_model_data_path")]
    pub initial_model_data_path: String,
    #[serde(default = "default_system_prompt_file_path")]
    pub system_prompt_file_path: String,
    #[serde(default = "default_openai_api_key")]
    pub openai_api_key: String,
}

fn default_initial_model_data_path() -> String {
    std::env::current_dir()
        .unwrap()
        .join("model.zip")
        .to_str()
        .unwrap()
        .to_string()
}

fn default_system_prompt_file_path() -> String {
    std::env::current_dir()
        .unwrap()
        .join("system_prompt.txt")
        .to_str()
        .unwrap()
        .to_string()
}

fn default_openai_api_key() -> String {
    std::env::var("OPENAI_API_KEY").unwrap()
}
