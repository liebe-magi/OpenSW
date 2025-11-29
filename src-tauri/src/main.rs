// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

mod audio;

use audio::AudioState;

fn main() {
    tauri::Builder::default()
        .manage(AudioState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            audio::start_recording,
            audio::stop_recording,
            audio::play_recording,
            audio::get_input_devices
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
