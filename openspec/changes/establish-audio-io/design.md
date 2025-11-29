# Design: Audio I/O Infrastructure

## Architecture

The system follows a standard Tauri architecture:

```mermaid
graph TD
    UI[React Frontend] <-->|Tauri Commands| Core[Rust Backend]
    Core -->|cpal| Mic[Microphone Input]
    Core -->|hound| FileSystem[Temp Storage (.wav)]
    Core -->|rodio| Speaker[Audio Output]
```

### Data Flow

1.  **Record**: UI sends `start_recording` -> Rust spawns audio thread -> `cpal` captures stream -> Data buffered in memory (`Arc<Mutex<Vec<f32>>>`).
2.  **Stop**: UI sends `stop_recording` -> Rust stops stream -> Buffer flushed to disk via `hound` (`recording_test.wav`).
3.  **Play**: UI sends `play_recording` -> Rust reads WAV file -> `rodio` plays audio.

## Technical Decisions

### Libraries

- **`cpal`**: Chosen for low-level cross-platform audio input access. It's the standard in the Rust ecosystem.
- **`hound`**: Simple, pure-Rust WAV encoder/decoder. Sufficient for Phase 1 requirements.
- **`rodio`**: High-level audio playback library that simplifies output device management.

### Audio Format

- **Input**: Native device sample rate (usually 44.1kHz or 48kHz).
- **Storage**: 32-bit float or 16-bit integer WAV.
  - _Rationale_: High fidelity for debugging. Downsampling to 16kHz (for Whisper) is deferred to Phase 2.
- **Channels**: Mix down to Mono on save.
  - _Rationale_: Whisper requires mono audio.

### OS Specifics

#### macOS

- **Permissions**: Must add `NSMicrophoneUsageDescription` to `src-tauri/Info.plist`.
- **Threading**: CoreAudio can be sensitive to main thread blocking. Audio work _must_ be offloaded.

#### Windows

- **Host**: Default to WASAPI (via `cpal` default host).
- **Pathing**: Use standard Windows Temp folder.

## API Interface (Tauri Commands)

```rust
#[tauri::command]
fn start_recording(state: State<AppState>) -> Result<(), String>;

#[tauri::command]
fn stop_recording(state: State<AppState>) -> Result<String, String>; // Returns path

#[tauri::command]
fn play_recording(state: State<AppState>) -> Result<(), String>;

// Event definition
// Rust -> Frontend
// Emitted periodically (e.g., every 100ms) during recording
#[derive(Clone, Serialize)]
struct AudioLevelEvent {
    amplitude: f32, // 0.0 to 1.0 (RMS or Peak)
}
// Frontend listens to: "audio-level-update"
```
