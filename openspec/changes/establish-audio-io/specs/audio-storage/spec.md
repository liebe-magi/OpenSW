# Spec: Audio Storage

## ADDED Requirements

### Requirement: Save to Temporary WAV File
The system MUST save the captured audio data as a WAV file in the OS temporary directory.

#### Scenario: Save on Stop
Given the application is in "Recording" state
When the user clicks "Stop"
Then the recording stops
And the audio data is flushed to a file named `recording_test.wav` in the system temp folder
And the application state changes to "Ready"

### Requirement: Audio Format Standards
The saved audio file MUST use a standard format compatible with common players and future processing.

#### Scenario: Format Verification
Given a saved `recording_test.wav` file
When inspected
Then it has a valid WAV header
And the sample rate matches the capture device (e.g., 44.1kHz or 48kHz)
And the channel count is 1 (Mono)
