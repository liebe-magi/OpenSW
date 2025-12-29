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
mod tray;

use audio::AudioState;
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn select_model(
    app: tauri::AppHandle,
    state: tauri::State<'_, AudioState>,
) -> Result<String, String> {
    let file_path = app
        .dialog()
        .file()
        .add_filter("Whisper Model", &["bin"])
        .blocking_pick_file();

    if let Some(path) = file_path {
        let path_str = path.as_path().map_or_else(
            || Err("Invalid path".to_string()),
            |p| Ok(p.to_string_lossy().to_string()),
        )?;
        *state.model_path.lock().map_err(|e| e.to_string())? = Some(path_str.clone());
        Ok(path_str)
    } else {
        Err("No file selected".to_string())
    }
}

#[tauri::command]
async fn load_model(state: tauri::State<'_, AudioState>, path: String) -> Result<String, String> {
    use std::path::Path;
    if path.is_empty() {
        return Err("Empty path provided".to_string());
    }
    if !Path::new(&path).exists() {
        return Err(format!("Model file not found: {}", path));
    }
    *state.model_path.lock().map_err(|e| e.to_string())? = Some(path.clone());
    Ok(path)
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

    let mut text = String::new();
    for segment in state_w.as_iter() {
        let segment_text = segment.to_str_lossy().map_err(|e| e.to_string())?;
        text.push_str(segment_text.as_ref());
    }

    Ok(text)
}

#[tauri::command]
async fn get_ollama_models(base_url: String) -> Result<Vec<String>, String> {
    let url = base_url.clone();
    tauri::async_runtime::spawn_blocking(move || {
        ollama::get_models(&url).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn refine_text_with_ollama(
    base_url: String,
    text: String,
    model: String,
    prompt: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let final_prompt = prompt.replace("{text}", &text);
        ollama::generate(&base_url, &model, &final_prompt).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn copy_to_clipboard(text: String) -> Result<(), String> {
    clipboard::copy_text(&text).map_err(|e| e.to_string())
}

#[tauri::command]
async fn request_toggle_recording(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("toggle-recording", ());
    }
    Ok(())
}

#[tauri::command]
async fn set_window_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if mode == "compact" {
            // Compact mode: 400x80, Always on top, No decorations
            window
                .set_size(tauri::Size::Logical(tauri::LogicalSize {
                    width: 400.0,
                    height: 80.0,
                }))
                .map_err(|e| e.to_string())?;
            window.set_always_on_top(true).map_err(|e| e.to_string())?;
            window.set_decorations(false).map_err(|e| e.to_string())?;
            // Ensure window is visible (in case it was hidden)
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;
        } else {
            // Normal mode: 500x720, Normal behavior, Decorations enabled
            window
                .set_size(tauri::Size::Logical(tauri::LogicalSize {
                    width: 500.0,
                    height: 750.0,
                }))
                .map_err(|e| e.to_string())?;
            window.set_always_on_top(false).map_err(|e| e.to_string())?;
            window.set_decorations(true).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn hide_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        // Reset to normal mode before hiding
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 500.0,
                height: 750.0,
            }))
            .map_err(|e| e.to_string())?;
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        window.set_decorations(true).map_err(|e| e.to_string())?;
        // Hide the window
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    use tauri_plugin_global_shortcut::ShortcutState;
                    if event.state() == ShortcutState::Pressed
                        && let Some(window) = app.get_webview_window("main")
                    {
                        let _ = window.emit("toggle-recording", ());
                    }
                })
                .build(),
        )
        .manage(AudioState::new())
        .setup(|app| {
            // Setup system tray
            tray::setup_tray(app)?;

            // Register global shortcut
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
                // Use Ctrl+Alt+Space to avoid conflicts
                let shortcut =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::Space);

                // Unregister if already registered (from previous run)
                let _ = app.global_shortcut().unregister(shortcut);

                // Register the shortcut - don't panic if it fails (e.g., if another app uses it)
                if let Err(e) = app.global_shortcut().register(shortcut) {
                    eprintln!("Warning: Failed to register global shortcut: {}", e);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Only intercept close for main window
                if window.label() == "main" {
                    // Prevent the window from closing
                    api.prevent_close();
                    // Hide the window instead
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            audio::start_recording,
            audio::stop_recording,
            audio::play_recording,
            audio::get_input_devices,
            select_model,
            load_model,
            transcribe_audio,
            get_ollama_models,
            refine_text_with_ollama,
            copy_to_clipboard,
            request_toggle_recording,
            set_window_mode,
            hide_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
