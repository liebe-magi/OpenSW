# Proposal: Integrate Ollama and Clipboard

## Why
Enhance the existing speech-to-text functionality by integrating **Ollama** for AI-based text refinement and **System Clipboard** for easy export. This completes the core workflow: "Record -> Transcribe -> Refine -> Copy".

## Background
Step 2 (Whisper integration) provided raw transcription. However, raw speech often contains fillers ("um", "ah") and lacks proper punctuation. Users also need a seamless way to use the result in other applications.

## What Changes

### Backend (Rust)
1.  **Ollama Client**:
    *   Fetch available models from `http://localhost:11434/api/tags`.
    *   Send text to `http://localhost:11434/api/generate` for refinement using a specific prompt.
2.  **Clipboard**:
    *   Write text to the system clipboard using `arboard`.
3.  **Tauri Commands**:
    *   `get_ollama_models`: Returns list of model names.
    *   `refine_text_with_ollama(text, model, prompt)`: Returns refined text. Accepts custom prompt.
    *   `copy_to_clipboard(text)`: Writes to clipboard.

### Frontend (React)
1.  **Settings**:
    *   Dropdown to select Ollama model (populated dynamically).
    *   **Prompt Editor**: Text area to modify the system prompt used for refinement.
    *   Error handling for Ollama connection failures.
2.  **UI Layout**:
    *   Two-pane view: Raw Text (left/top) vs Refined Text (right/bottom).
    *   "Refine" button to trigger processing.
    *   "Copy" button to save refined text.

## Impact
*   **Specs**: New capability `ollama-integration`.
*   **Code**: New backend modules (`ollama.rs`, `clipboard.rs`), new frontend component (`OllamaSettings.tsx`), updated `AudioRecorder.tsx`.

## Dependencies
*   `reqwest`: For HTTP requests to Ollama.
*   `serde`, `serde_json`: For JSON handling.
*   `arboard`: For clipboard operations.
