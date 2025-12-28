# Proposal: Establish Audio I/O Infrastructure

## Summary

Establish the foundational audio pipeline for a cross-platform (Windows/macOS) AI Voice Assistant using Tauri. This phase focuses on enabling audio recording from the default microphone, saving the audio to a temporary WAV file, and playing it back to verify quality. This infrastructure is a prerequisite for future Whisper integration.

## Problem Statement

The current application lacks any audio processing capabilities. To build an AI Voice Assistant that can "Record -> Transcribe -> Correct -> Copy", we first need a reliable mechanism to capture and playback audio across different operating systems.

## Goals

1.  **Recording**: Capture audio from the system's default microphone.
2.  **Storage**: Save captured audio as a WAV file in the OS temporary directory.
3.  **Playback**: Play back the saved audio file to verify recording quality.
4.  **Cross-Platform**: Ensure all features work on both Windows and macOS.

## Non-Goals

- Real-time transcription (Whisper integration is Phase 2).
- Advanced audio processing (noise cancellation, VAD) beyond basic capture.
- Complex UI (UI will be minimal for debugging).
- Linux support (Phase 1 targets Windows and macOS only).

## Implementation Strategy

We will use a Tauri architecture with a React frontend and Rust backend.

- **Frontend**: Simple debug UI with Record/Stop/Play controls.
- **Backend**: Rust using `cpal` for input, `hound` for WAV encoding, and `rodio` for playback.
- **Communication**: Tauri Commands for frontend-backend interaction.

## Risks & Mitigations

- **macOS Permissions**: Microphone access requires `Info.plist` modification and potentially codesigning/entitlements.
  - _Mitigation_: Add `NSMicrophoneUsageDescription` to `Info.plist` early.
- **Audio Thread Blocking**: Audio processing on the main thread can freeze the UI.
  - _Mitigation_: Run audio capture/playback in separate threads (`tokio::spawn` or `std::thread`).
- **Device Availability**: No default input device might be available.
  - _Mitigation_: Graceful error handling and status reporting to the UI.
