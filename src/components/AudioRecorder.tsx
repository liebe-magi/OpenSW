import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { sendNotification } from '@tauri-apps/plugin-notification';
import OllamaSettings from './OllamaSettings';
import RecordingStatus from './RecordingStatus';

interface AudioLevelEvent {
  amplitude: number;
}

type PipelineStage = 'idle' | 'recording' | 'transcribing' | 'refining' | 'copying' | 'done';

export default function AudioRecorder() {
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState('Ready');
  const [deviceName, setDeviceName] = useState<string>('');
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(() => localStorage.getItem('selectedDevice') || '');
  const [modelPath, setModelPath] = useState(() => localStorage.getItem('modelPath') || '');
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [language, setLanguage] = useState('ja');
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('ollamaModel') || '');
  const [ollamaPrompt, setOllamaPrompt] = useState(() => localStorage.getItem('ollamaPrompt') ||
    "以下の文章の『えー』『あの』などのフィラーを取り除き、句読点を適切に補って、自然な日本語の文章に修正してください。出力は修正後の文章のみにしてください。\n\n対象の文章: {text}"
  );
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('ollamaUrl') || 'http://localhost:11434');
  const [refinedText, setRefinedText] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);

  const pipelineStageRef = useRef(pipelineStage);
  const selectedDeviceRef = useRef(selectedDevice);
  const ollamaModelRef = useRef(ollamaModel);
  const ollamaPromptRef = useRef(ollamaPrompt);
  const ollamaUrlRef = useRef(ollamaUrl);

  useEffect(() => { pipelineStageRef.current = pipelineStage; }, [pipelineStage]);
  useEffect(() => { selectedDeviceRef.current = selectedDevice; }, [selectedDevice]);
  useEffect(() => {
    ollamaModelRef.current = ollamaModel;
    ollamaPromptRef.current = ollamaPrompt;
    ollamaUrlRef.current = ollamaUrl;
    localStorage.setItem('ollamaModel', ollamaModel);
    localStorage.setItem('ollamaPrompt', ollamaPrompt);
    localStorage.setItem('ollamaUrl', ollamaUrl);
  }, [ollamaModel, ollamaPrompt, ollamaUrl]);
  useEffect(() => { localStorage.setItem('selectedDevice', selectedDevice); }, [selectedDevice]);
  useEffect(() => { localStorage.setItem('modelPath', modelPath); }, [modelPath]);

  useEffect(() => {
    const savedPath = localStorage.getItem('modelPath');
    if (savedPath) {
      invoke<string>('load_model', { path: savedPath })
        .then(() => setStatus('Model loaded'))
        .catch(() => { setStatus('Model file not found'); setModelPath(''); });
    }
  }, []);

  useEffect(() => {
    if (pipelineStage === 'done') {
      const timer = setTimeout(async () => {
        // Hide window instead of restoring normal mode
        await invoke('hide_window');
        setPipelineStage('idle');
        setStatus('Ready');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [pipelineStage]);

  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const deviceList = await invoke<string[]>('get_input_devices');
      setDevices(deviceList);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setLoadingDevices(false);
    }
  };

  const startRecording = async () => {
    try {
      await invoke('set_window_mode', { mode: 'compact' });
      const device = await invoke<string>('start_recording', {
        deviceName: selectedDeviceRef.current || null,
      });
      setPipelineStage('recording');
      setDeviceName(device);
      setStatus('Recording...');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setStatus(`Error: ${error}`);
      await invoke('set_window_mode', { mode: 'normal' });
    }
  };

  const stopAndProcess = async () => {
    try {
      setPipelineStage('transcribing');
      await invoke<string>('stop_recording');
      setAudioLevel(0);
      setStatus('Transcribing...');

      const text = await invoke<string>('transcribe_audio', { language: 'ja' });
      setTranscription(text);

      let finalText = text;

      if (ollamaModelRef.current) {
        setPipelineStage('refining');
        setStatus('Refining...');
        finalText = await invoke<string>('refine_text_with_ollama', {
          baseUrl: ollamaUrlRef.current,
          text: text,
          model: ollamaModelRef.current,
          prompt: ollamaPromptRef.current
        });
        setRefinedText(finalText);
      }

      setPipelineStage('copying');
      setStatus('Copying...');
      await invoke('copy_to_clipboard', { text: finalText });

      setPipelineStage('done');
      setStatus('Copied to clipboard!');

      sendNotification({ title: 'OpenSW', body: 'Transcription copied to clipboard' });

    } catch (error) {
      console.error('Pipeline failed:', error);
      setStatus(`Error: ${error}`);
      await invoke('set_window_mode', { mode: 'normal' });
      setPipelineStage('idle');
    }
  };

  useEffect(() => {
    const unlistenAudioLevel = listen<AudioLevelEvent>('audio-level-update', (event) => {
      setAudioLevel(event.payload.amplitude);
    });

    const unlistenToggle = listen('toggle-recording', async () => {
      if (pipelineStageRef.current === 'idle') {
        startRecording();
      } else if (pipelineStageRef.current === 'recording') {
        stopAndProcess();
      }
    });

    fetchDevices();

    return () => {
      unlistenAudioLevel.then((f) => f());
      unlistenToggle.then((f) => f());
    };
  }, []);

  const selectModel = async () => {
    try {
      const path = await invoke<string>('select_model');
      setModelPath(path);
      setStatus('Model loaded');
    } catch (error) {
      console.error('Failed to select model:', error);
      setStatus(`Error: ${error}`);
    }
  };

  if (pipelineStage !== 'idle') {
    return (
      <RecordingStatus
        stage={pipelineStage}
        onStop={() => {
          if (pipelineStage === 'recording') {
            invoke('request_toggle_recording').catch(console.error);
          }
        }}
      />
    );
  }

  const getModelFileName = (path: string) => {
    if (!path) return null;
    const parts = path.split(/[\/\\]/);
    return parts[parts.length - 1];
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <h1>OpenSW</h1>
        <span className="shortcut-hint">Ctrl+Alt+Space to record</span>
      </header>

      <section className="settings-section">
        <h2>Audio Input</h2>
        <div className="setting-row">
          <label>Device</label>
          <div className="input-group">
            <div className="select-wrapper">
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
              >
                <option value="">System Default</option>
                {devices.map((device) => (
                  <option key={device} value={device}>{device}</option>
                ))}
              </select>
              <span className="select-arrow">▼</span>
            </div>
            <button onClick={fetchDevices} disabled={loadingDevices} className="icon-btn" title="Refresh devices">
              ↻
            </button>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Whisper Model</h2>
        <div className="setting-row">
          <label>Model File</label>
          <div className="file-selector">
            <button onClick={selectModel} className="select-btn">
              {modelPath ? 'Change' : 'Select'}
            </button>
            <span className="file-name">
              {getModelFileName(modelPath) || 'No model selected'}
            </span>
          </div>
        </div>
        <div className="setting-row">
          <label>Language</label>
          <div className="input-group">
            <div className="select-wrapper">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="ja">Japanese</option>
                <option value="en">English</option>
              </select>
              <span className="select-arrow">▼</span>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Text Refinement (Ollama)</h2>
        <OllamaSettings
          selectedModel={ollamaModel}
          onModelChange={setOllamaModel}
          prompt={ollamaPrompt}
          onPromptChange={setOllamaPrompt}
          baseUrl={ollamaUrl}
          onBaseUrlChange={setOllamaUrl}
        />
      </section>

      <footer className="settings-footer">
        <div className="status-bar">
          <span className={`status-dot ${status === 'Ready' || status === 'Model loaded' ? 'ready' : ''}`}></span>
          <span>{status}</span>
        </div>
      </footer>

      <style>{`
        .settings-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 20px 24px;
          box-sizing: border-box;
          background: linear-gradient(180deg, rgba(15, 15, 18, 1) 0%, rgba(20, 20, 25, 1) 100%);
          overflow: hidden;
        }
        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .settings-header h1 {
          font-size: 1.4em;
          font-weight: 700;
          background: linear-gradient(135deg, #646cff 0%, #9f5afd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }
        .shortcut-hint {
          font-size: 0.8em;
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 10px;
          border-radius: 4px;
        }
        .settings-section {
          margin-bottom: 16px;
        }
        .settings-section h2 {
          font-size: 0.75em;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255, 255, 255, 0.4);
          margin: 0 0 10px 0;
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
        .file-selector {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-left: 20px;
          flex: 1;
          justify-content: flex-end;
        }
        .select-btn {
          background: linear-gradient(135deg, #646cff 0%, #535bf2 100%);
          border: none;
          color: white;
          padding: 6px 14px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.85em;
          cursor: pointer;
          transition: all 0.2s;
        }
        .select-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(100, 108, 255, 0.3);
        }
        .file-name {
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.5);
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .settings-footer {
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
        .status-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.6);
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
        }
        .status-dot.ready {
          background: #4dff88;
          box-shadow: 0 0 8px rgba(77, 255, 136, 0.5);
        }
      `}</style>
    </div>
  );
}
