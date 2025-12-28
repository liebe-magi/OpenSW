import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface OllamaSettingsProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
}

export default function OllamaSettings({
  selectedModel,
  onModelChange,
  prompt,
  onPromptChange,
  baseUrl,
  onBaseUrlChange,
}: OllamaSettingsProps) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (baseUrl) {
      fetchModels();
    }
  }, []);

  const fetchModels = async () => {
    if (!baseUrl) return;
    setLoading(true);
    setError('');
    try {
      const fetchedModels = await invoke<string[]>('get_ollama_models', { baseUrl });
      setModels(fetchedModels);
      if (fetchedModels.length > 0 && !selectedModel) {
        onModelChange(fetchedModels[0]);
      }
    } catch (err) {
      setError('Ollama not available');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ollama-settings">
      {error && <div className="error-msg">{error}</div>}

      <div className="setting-row">
        <label>URL</label>
        <div className="input-group">
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="http://localhost:11434"
            className="url-input"
          />
        </div>
      </div>

      <div className="setting-row">
        <label>Model</label>
        <div className="input-group">
          <div className="select-wrapper">
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              disabled={loading || !baseUrl}
            >
              <option value="">None (Skip)</option>
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
            <span className="select-arrow">▼</span>
          </div>
          <button onClick={fetchModels} disabled={loading || !baseUrl} className="icon-btn" title="Refresh models">
            ↻
          </button>
        </div>
      </div>

      <div className="setting-row prompt-row">
        <label>Prompt Template</label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Use {text} as placeholder..."
          rows={3}
        />
      </div>

      <style>{`
        .ollama-settings {
          margin-top: 0;
        }
        .error-msg {
          font-size: 0.8em;
          color: rgba(255, 77, 77, 0.8);
          padding: 6px 12px;
          background: rgba(255, 77, 77, 0.1);
          border-radius: 6px;
          margin-bottom: 6px;
        }
        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          margin-bottom: 6px;
        }
        .setting-row label {
          font-size: 0.9em;
          color: rgba(255, 255, 255, 0.8);
          flex-shrink: 0;
        }
        .input-group {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 20px;
          flex: 1;
          justify-content: flex-end;
        }
        .url-input {
          flex: 1;
          max-width: 280px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.9em;
        }
        .url-input:focus {
          outline: none;
          border-color: #646cff;
        }
        .url-input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
        .select-wrapper {
          position: relative;
          flex: 1;
          max-width: 280px;
        }
        .select-wrapper select {
          width: 100%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 6px 32px 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
        }
        .select-wrapper select:focus {
          outline: none;
          border-color: #646cff;
        }
        .select-arrow {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.6em;
          color: rgba(255, 255, 255, 0.5);
          pointer-events: none;
        }
        .icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          min-width: 32px;
          background: rgba(100, 108, 255, 0.15);
          border: 1px solid rgba(100, 108, 255, 0.3);
          border-radius: 6px;
          color: #646cff;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 1.1em;
          font-weight: bold;
        }
        .icon-btn:hover:not(:disabled) {
          background: rgba(100, 108, 255, 0.25);
          border-color: #646cff;
        }
        .icon-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .prompt-row {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }
        .prompt-row label {
          align-self: flex-start;
        }
        .prompt-row textarea {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 10px 12px;
          border-radius: 6px;
          font-family: inherit;
          font-size: 0.85em;
          resize: vertical;
          min-height: 55px;
        }
        .prompt-row textarea:focus {
          outline: none;
          border-color: #646cff;
        }
        .prompt-row textarea::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
