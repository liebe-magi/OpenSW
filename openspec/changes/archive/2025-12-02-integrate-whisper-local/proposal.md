# Integrate Local Whisper Model

## Summary

This proposal introduces local speech-to-text capabilities using OpenAI's Whisper model via `whisper-rs`. It builds upon the existing audio recording functionality to allow users to transcribe recorded audio into text using a locally selected model file.

## Motivation

To provide privacy-focused, offline-capable speech recognition within the application without relying on external APIs.

## Goals

- Enable users to select a local Whisper model file (`.bin`).
- Transcribe recorded audio (`recording_test.wav`) to text.
- Display transcription results in the UI.
- Ensure cross-platform compatibility (Windows/macOS).

## Non-Goals

- Real-time streaming transcription (batch processing only for this phase).
- Model file downloading within the app (user must provide the file).
- Persistent storage of the model path across app restarts (optional for this phase).
