# Spec: Clipboard Integration

## ADDED Requirements

### Requirement: Copy to Clipboard

The system MUST allow the user to copy text to the system clipboard.

#### Scenario: Copy refined text

- **Given** the refined text is "Hello World"
- **When** the user clicks the "Copy" button
- **Then** the text "Hello World" should be available in the system clipboard
- **And** the UI should provide feedback (e.g., "Copied!")
