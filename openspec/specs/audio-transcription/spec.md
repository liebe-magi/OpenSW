# audio-transcription Specification

## Purpose

TBD - created by archiving change integrate-whisper-local. Update Purpose after archive.

## Requirements

### Requirement: Model Selection

The system SHALL allow the user to select a local Whisper model file (`.bin`) from their file system.

#### Scenario: User selects a Whisper model

- **Given** the user is on the main interface
- **When** the user clicks the "Select Model" button
- **Then** a system file dialog opens allowing selection of `.bin` files
- **And** upon selection, the model path is stored in the application state
- **And** the UI reflects the selected model (or enables the Transcribe button)

### Requirement: Audio Transcription

The system SHALL be able to transcribe recorded audio using the selected Whisper model.

#### Scenario: User transcribes recorded audio

- **Given** a valid Whisper model is selected
- **And** an audio recording (`recording_test.wav`) exists
- **When** the user clicks the "Transcribe" button
- **Then** the application reads the audio file
- **And** converts/resamples the audio to 16kHz mono float32
- **And** runs inference using the selected Whisper model
- **And** displays the transcribed text in the UI upon completion
- **And** shows a loading indicator during the process

### Requirement: Error Handling

The system SHALL handle cases where the model is missing or invalid.

#### Scenario: Missing model handling

- **Given** no model is selected
- **When** the user attempts to transcribe
- **Then** the action is prevented or an error is returned indicating a model must be selected first
