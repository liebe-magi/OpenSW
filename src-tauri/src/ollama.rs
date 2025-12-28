use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::time::Duration;

#[derive(Serialize, Deserialize, Debug)]
pub struct OllamaModel {
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Serialize, Debug)]
struct GenerateRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Deserialize, Debug)]
struct GenerateResponse {
    response: String,
}

pub fn get_models(base_url: &str) -> Result<Vec<String>, Box<dyn Error>> {
    let client = Client::builder().timeout(Duration::from_secs(10)).build()?;
    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));
    let res = client.get(&url).send()?;
    let tags_response: OllamaTagsResponse = res.json()?;

    Ok(tags_response.models.into_iter().map(|m| m.name).collect())
}

pub fn generate(base_url: &str, model: &str, prompt: &str) -> Result<String, Box<dyn Error>> {
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()?;
    let req = GenerateRequest {
        model: model.to_string(),
        prompt: prompt.to_string(),
        stream: false,
    };

    let url = format!("{}/api/generate", base_url.trim_end_matches('/'));
    let res = client.post(&url).json(&req).send()?;

    let gen_response: GenerateResponse = res.json()?;
    Ok(gen_response.response)
}
