# Architecture & Design

## System Flow

```mermaid
graph TD
    User[User] -->|Selects Model File| UI[Frontend]
    UI -->|'select_model' command| State[AppState]
    State -->|Stores Path| ModelPath[Model File Path]

    User -->|Clicks Transcribe| UI
    UI -->|'transcribe' command| Core[Rust Backend]

    Core -->|Read| Wav[recording_test.wav]
    Core -->|Load| Model[Whisper Model (.bin)]

    subgraph "Audio Pre-processing"
        Wav -->|Decode| RawAudio[Raw Samples]
        RawAudio -->|Mix & Convert| MonoF32[Mono f32]
        MonoF32 -->|Resample| Resampled[16kHz Mono Samples]
    end

    Resampled -->|Inference| Whisper[whisper-rs]
    Whisper -->|Result String| Text[Transcribed Text]
    Text -->|Return| UI
```

## Technical Constraints & Decisions

1.  **Library**: `whisper-rs` (version 0.13+)
    - _Reasoning:_ Rust bindings for the C++ implementation `whisper.cpp`, providing a lightweight and high-performance solution.
2.  **Audio Format Mismatch**:
    - **Input**: `recording_test.wav` is device-dependent (typically 44.1kHz or 48kHz).
    - **Required**: Whisper requires **16kHz, Mono, f32**.
    - **Solution**: Implement resampling in Rust using `rubato` or `samplerate` crates during the file read process.
3.  **Model Management**:
    - Model files (`.bin`) are not bundled with the application.
    - Users must select a `.bin` file via a file dialog.
    - The path is stored in `AppState` (persistence is optional for this phase, but must be held during the session).
