use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;

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

pub fn get_models() -> Result<Vec<String>, Box<dyn Error>> {
    let client = Client::new();
    let res = client.get("http://localhost:11434/api/tags").send()?;
    let tags_response: OllamaTagsResponse = res.json()?;

    Ok(tags_response.models.into_iter().map(|m| m.name).collect())
}

pub fn generate(model: &str, prompt: &str) -> Result<String, Box<dyn Error>> {
    let client = Client::new();
    let req = GenerateRequest {
        model: model.to_string(),
        prompt: prompt.to_string(),
        stream: false,
    };

    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&req)
        .send()?;

    let gen_response: GenerateResponse = res.json()?;
    Ok(gen_response.response)
}
