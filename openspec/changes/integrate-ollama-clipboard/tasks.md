# Tasks: Integrate Ollama & Clipboard

- [x] Add `reqwest`, `serde`, `serde_json`, `arboard` to `src-tauri/Cargo.toml` <!-- id: 0 -->
- [x] Create `src-tauri/src/ollama.rs` with `get_models` and `generate` functions <!-- id: 1 -->
- [x] Implement `copy_to_clipboard` logic in `src-tauri/src/lib.rs` (or new module) <!-- id: 2 -->
- [x] Implement Tauri command `get_ollama_models` <!-- id: 3 -->
- [x] Implement Tauri command `refine_text_with_ollama` <!-- id: 4 -->
- [x] Implement Tauri command `copy_to_clipboard` <!-- id: 5 -->
- [x] Register new commands in `src-tauri/src/lib.rs` (builder) <!-- id: 6 -->
- [x] Create `OllamaSettings` component in Frontend (Model selector + Prompt editor) <!-- id: 7 -->
- [x] Update `TranscriptionView` to show Raw/Refined panes <!-- id: 8 -->
- [x] Wire up "Refine" and "Copy" buttons (pass custom prompt) <!-- id: 9 -->
- [x] Verify: Run app, select model, refine text, copy to clipboard <!-- id: 10 -->
