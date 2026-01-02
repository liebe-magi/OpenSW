import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { sendNotification } from '@tauri-apps/plugin-notification';
import OllamaSettings from './OllamaSettings';
import RecordingStatus from './RecordingStatus';
import UpdateChecker from './UpdateChecker';

interface AudioLevelEvent {
  amplitude: number;
}

type PipelineStage = 'idle' | 'recording' | 'transcribing' | 'refining' | 'copying' | 'done';

export default function AudioRecorder() {
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
  const [, setAudioLevel] = useState(0);
  const [status, setStatus] = useState('Ready');
  const [, setDeviceName] = useState<string>('');
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(
    () => localStorage.getItem('selectedDevice') || ''
  );
  const [modelPath, setModelPath] = useState(() => localStorage.getItem('modelPath') || '');
  const [, setTranscription] = useState('');
  const [language, setLanguage] = useState('ja');
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('ollamaModel') || '');
  const [ollamaPrompt, setOllamaPrompt] = useState(
    () =>
      localStorage.getItem('ollamaPrompt') ||
      '以下の文章の『えー』『あの』などのフィラーを取り除き、句読点を適切に補って、自然な日本語の文章に修正してください。出力は修正後の文章のみにしてください。\n\n対象の文章: {text}'
  );
  const [ollamaUrl, setOllamaUrl] = useState(
    () => localStorage.getItem('ollamaUrl') || 'http://localhost:11434'
  );
  const [, setRefinedText] = useState('');
  const [loadingDevices, setLoadingDevices] = useState(false);

  const pipelineStageRef = useRef(pipelineStage);
  const selectedDeviceRef = useRef(selectedDevice);
  const ollamaModelRef = useRef(ollamaModel);
  const ollamaPromptRef = useRef(ollamaPrompt);
  const ollamaUrlRef = useRef(ollamaUrl);

  const [computeDevices, setComputeDevices] = useState<{ name: string; device_type: string }[]>([]);
  const [selectedComputeDevice, setSelectedComputeDevice] = useState<string>(
    () => localStorage.getItem('selectedComputeDevice') || 'cpu'
  );
  const selectedComputeDeviceRef = useRef(selectedComputeDevice);

  useEffect(() => {
    selectedComputeDeviceRef.current = selectedComputeDevice;
    localStorage.setItem('selectedComputeDevice', selectedComputeDevice);
  }, [selectedComputeDevice]);

  useEffect(() => {
    // Fetch compute devices
    invoke<{ name: string; device_type: string }[]>('get_compute_devices')
      .then((devices) => {
        setComputeDevices(devices);
        // If saved device is not available, fallback to cpu
        if (!devices.find((d) => d.device_type === selectedComputeDevice)) {
          setSelectedComputeDevice('cpu');
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  const [activeTab, setActiveTab] = useState<'home' | 'settings'>('home');

  useEffect(() => {
    pipelineStageRef.current = pipelineStage;
  }, [pipelineStage]);
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);
  useEffect(() => {
    ollamaModelRef.current = ollamaModel;
    ollamaPromptRef.current = ollamaPrompt;
    ollamaUrlRef.current = ollamaUrl;
    localStorage.setItem('ollamaModel', ollamaModel);
    localStorage.setItem('ollamaPrompt', ollamaPrompt);
    localStorage.setItem('ollamaUrl', ollamaUrl);
  }, [ollamaModel, ollamaPrompt, ollamaUrl]);
  useEffect(() => {
    localStorage.setItem('selectedDevice', selectedDevice);
  }, [selectedDevice]);
  useEffect(() => {
    localStorage.setItem('modelPath', modelPath);
  }, [modelPath]);

  useEffect(() => {
    const savedPath = localStorage.getItem('modelPath');
    if (savedPath) {
      invoke<string>('load_model', { path: savedPath })
        .then(() => setStatus('Model loaded'))
        .catch(() => {
          setStatus('Model file not found');
          setModelPath('');
        });
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

      const isMacOS = navigator.userAgent.includes('Mac');
      const text = await invoke<string>('transcribe_audio', {
        language: 'ja',
        useGpu: selectedComputeDeviceRef.current === 'gpu' || isMacOS,
      });
      setTranscription(text);

      let finalText = text;

      if (ollamaModelRef.current) {
        setPipelineStage('refining');
        setStatus('Refining...');
        finalText = await invoke<string>('refine_text_with_ollama', {
          baseUrl: ollamaUrlRef.current,
          text: text,
          model: ollamaModelRef.current,
          prompt: ollamaPromptRef.current,
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
    const parts = path.split(new RegExp('[\\\\/]'));
    return parts[parts.length - 1];
  };

  return (
    <div className="settings-container">
      <header className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          Home
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </header>

      <div className="tab-content">
        {activeTab === 'home' && (
          <div className="home-panel">
            <div className="hero-section">
              <h1>OpenSW</h1>
              <p className="status-message">{status}</p>
              <div className="shortcut-display">
                <span className="key">Ctrl</span>
                <span className="plus">+</span>
                <span className="key">Alt</span>
                <span className="plus">+</span>
                <span className="key">Space</span>
              </div>
              <p className="hint-text">to start recording</p>
            </div>

            <section className="settings-section home-settings">
              <div className="setting-row">
                <label>Language</label>
                <div className="input-group">
                  <div className="select-wrapper">
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                      <option value="ja">Japanese</option>
                      <option value="en">English</option>
                    </select>
                    <span className="select-arrow">▼</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-panel">
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
                        <option key={device} value={device}>
                          {device}
                        </option>
                      ))}
                    </select>
                    <span className="select-arrow">▼</span>
                  </div>
                  <button
                    onClick={fetchDevices}
                    disabled={loadingDevices}
                    className="icon-btn"
                    title="Refresh devices"
                  >
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
              {!navigator.userAgent.includes('Mac') && (
                <div className="setting-row">
                  <label>Inference Device</label>
                  <div className="input-group">
                    <div className="select-wrapper">
                      <select
                        value={selectedComputeDevice}
                        onChange={(e) => setSelectedComputeDevice(e.target.value)}
                      >
                        {computeDevices.map((device) => (
                          <option key={device.device_type} value={device.device_type}>
                            {device.name}
                          </option>
                        ))}
                      </select>
                      <span className="select-arrow">▼</span>
                    </div>
                  </div>
                </div>
              )}
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

            <section className="settings-section">
              <h2>App Updates</h2>
              <UpdateChecker />
            </section>
          </div>
        )}
      </div>

      <footer className="settings-footer">
        <div className="status-bar">
          <span
            className={`status-dot ${status === 'Ready' || status === 'Model loaded' ? 'ready' : ''}`}
          ></span>
          <span>{status}</span>
        </div>
      </footer>

      <style>{`
        .settings-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: linear-gradient(180deg, rgba(15, 15, 18, 1) 0%, rgba(20, 20, 25, 1) 100%);
          overflow: hidden;
        }
        .tabs-header {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          padding: 14px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
        }
        .tab-btn:hover {
          color: rgba(255, 255, 255, 0.8);
          background: rgba(255, 255, 255, 0.02);
        }
        .tab-btn.active {
          color: #fff;
          border-bottom-color: #646cff;
          background: rgba(100, 108, 255, 0.05);
        }
        .tab-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }
        .home-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 40px;
        }
        .hero-section {
          text-align: center;
        }
        .hero-section h1 {
          font-size: 2.5em;
          font-weight: 800;
          background: linear-gradient(135deg, #646cff 0%, #9f5afd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0 0 10px 0;
          letter-spacing: -1px;
        }
        .status-message {
          font-size: 1.1em;
          color: rgba(255, 255, 255, 0.7);
          margin: 0 0 30px 0;
        }
        .shortcut-display {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .key {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 6px 12px;
          font-family: monospace;
          font-weight: bold;
          font-size: 1.1em;
          color: #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .plus {
          color: rgba(255, 255, 255, 0.4);
        }
        .hint-text {
          font-size: 0.9em;
          color: rgba(255, 255, 255, 0.4);
          margin: 0;
        }
        .home-settings {
          width: 100%;
          max-width: 320px;
        }
        .settings-section {
          margin-bottom: 24px;
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
          padding: 12px 14px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          margin-bottom: 8px;
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
          padding: 8px 32px 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          font-size: 0.95em;
        }
        .select-wrapper select:focus {
          outline: none;
          border-color: #646cff;
        }
        .select-arrow {
          position: absolute;
          right: 12px;
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
          width: 36px;
          height: 36px;
          min-width: 36px;
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
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 600;
          font-size: 0.9em;
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
          padding: 12px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.2);
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
