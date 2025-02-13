use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub initial_model_data_path: String,
}
