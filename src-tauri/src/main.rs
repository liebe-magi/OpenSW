// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod audio;
mod audio_utils;
mod clipboard;
mod ollama;

use audio::AudioState;
use tauri::api::dialog::blocking::FileDialogBuilder;

#[tauri::command]
async fn select_model(state: tauri::State<'_, AudioState>) -> Result<String, String> {
    let file_path = FileDialogBuilder::new()
        .add_filter("Whisper Model", &["bin"])
        .pick_file();

    if let Some(path) = file_path {
        let path_str = path.to_string_lossy().to_string();
        *state.model_path.lock().map_err(|e| e.to_string())? = Some(path_str.clone());
        Ok(path_str)
    } else {
        Err("No file selected".to_string())
    }
}

#[tauri::command]
async fn transcribe_audio(
    state: tauri::State<'_, AudioState>,
    language: Option<String>,
) -> Result<String, String> {
    let model_path_opt = state.model_path.lock().map_err(|e| e.to_string())?.clone();
    let model_path = model_path_opt.ok_or("No model selected")?;

    // Load model
    let ctx = whisper_rs::WhisperContext::new_with_params(
        &model_path,
        whisper_rs::WhisperContextParameters::default(),
    )
    .map_err(|e| e.to_string())?;
    let mut state_w = ctx.create_state().map_err(|e| e.to_string())?;

    // Read audio
    let temp_dir = std::env::temp_dir();
    let audio_path = temp_dir.join("recording_test.wav");
    let audio_path_str = audio_path.to_string_lossy().to_string();

    let samples = audio_utils::read_and_resample(&audio_path_str).map_err(|e| e.to_string())?;

    // Run inference
    let mut params =
        whisper_rs::FullParams::new(whisper_rs::SamplingStrategy::Greedy { best_of: 1 });

    let lang_str = language.unwrap_or_else(|| "en".to_string());
    params.set_language(Some(&lang_str));

    state_w.full(params, &samples).map_err(|e| e.to_string())?;

    let num_segments = state_w.full_n_segments().map_err(|e| e.to_string())?;
    let mut text = String::new();
    for i in 0..num_segments {
        let segment = state_w
            .full_get_segment_text(i)
            .map_err(|e| e.to_string())?;
        text.push_str(&segment);
    }

    Ok(text)
}

#[tauri::command]
async fn get_ollama_models() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| ollama::get_models().map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn refine_text_with_ollama(
    text: String,
    model: String,
    prompt: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let final_prompt = prompt.replace("{text}", &text);
        ollama::generate(&model, &final_prompt).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn copy_to_clipboard(text: String) -> Result<(), String> {
    clipboard::copy_text(&text).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .manage(AudioState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            audio::start_recording,
            audio::stop_recording,
            audio::play_recording,
            audio::get_input_devices,
            select_model,
            transcribe_audio,
            get_ollama_models,
            refine_text_with_ollama,
            copy_to_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
