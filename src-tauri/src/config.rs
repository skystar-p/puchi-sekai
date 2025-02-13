use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    #[serde(default = "default_initial_model_data_path")]
    pub initial_model_data_path: String,
}

fn default_initial_model_data_path() -> String {
    std::env::current_dir()
        .unwrap()
        .join("model.zip")
        .to_str()
        .unwrap()
        .to_string()
}
