# Spec: Audio Playback

## ADDED Requirements

### Requirement: Playback Recorded Audio
The system MUST be able to play back the most recently recorded audio file.

#### Scenario: Playback
Given a recording has been saved
When the user clicks "Play"
Then the system plays the `recording_test.wav` file through the default output device
And the application state indicates "Playing"

#### Scenario: Playback Completion
Given the application is playing audio
When the audio file ends
Then the application state returns to "Ready"
