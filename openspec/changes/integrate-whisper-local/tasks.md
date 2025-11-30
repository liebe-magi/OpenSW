# Implementation Tasks

- [x] **Dependency Setup**
  - [x] Add `whisper-rs`, `rubato` (or appropriate resampling library), and `anyhow` to `src-tauri/Cargo.toml`.
  - [x] Ensure `tauri` dependency in `src-tauri/Cargo.toml` has `features = [..., "dialog", "fs", ...]` enabled.
  - [x] Verify system dependencies (e.g., `libclang`) required for building `whisper-rs`.

- [x] **State Management**
  - [x] Add `model_path: Mutex<Option<String>>` to the `AppState` struct in `src-tauri/src/main.rs` (or `lib.rs`).

- [x] **Audio Processing Logic**
  - [x] Create `src-tauri/src/audio_utils.rs` (recommended) and implement:
    - [x] WAV file reading (using existing `hound` crate).
    - [x] Stereo to Mono conversion (channel averaging).
    - [x] Resampling logic (Convert _Dynamic Source Rate_ -> 16000Hz).

- [x] **Tauri Commands**
  - [x] Implement `select_model` command (open file dialog and update State).
  - [x] Implement `transcribe_audio` command (process audio and run `whisper-rs`).

- [x] **UI Integration**
  - [x] Add Model Selector UI (button/display) to `AudioRecorder.tsx`.
  - [x] Add Transcription UI (Transcribe button, loading state, result text area) to `AudioRecorder.tsx`.
  - [x] Verify frontend-backend communication.
