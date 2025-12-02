import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface OllamaSettingsProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
}

export default function OllamaSettings({
  selectedModel,
  onModelChange,
  prompt,
  onPromptChange,
}: OllamaSettingsProps) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fetchedModels = await invoke<string[]>('get_ollama_models');
      setModels(fetchedModels);
      if (fetchedModels.length > 0 && !selectedModel) {
        onModelChange(fetchedModels[0]);
      }
    } catch (err) {
      setError(`Failed to load models: ${err}`);
    } finally {
      setLoading(false);
    }
  }, [selectedModel, onModelChange]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return (
    <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
      <h3>Ollama Settings</h3>

      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

      <div style={{ marginBottom: '10px' }}>
        <label style={{ marginRight: '10px' }}>Model:</label>
        <select
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={loading}
          style={{ padding: '5px', borderRadius: '4px' }}
        >
          <option value="">Select a model</option>
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <button
          onClick={fetchModels}
          disabled={loading}
          style={{ marginLeft: '10px', padding: '5px 10px' }}
        >
          Refresh
        </button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>Refinement Prompt:</label>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          style={{ width: '100%', height: '80px', padding: '10px' }}
        />
        <div style={{ fontSize: '0.8em', color: '#666', marginTop: '5px' }}>
          Use <code>{'{text}'}</code> as a placeholder for the transcribed text.
        </div>
      </div>
    </div>
  );
}
