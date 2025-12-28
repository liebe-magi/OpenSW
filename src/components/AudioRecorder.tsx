import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { sendNotification } from '@tauri-apps/plugin-notification';
import OllamaSettings from './OllamaSettings';
import RecordingStatus from './RecordingStatus';

interface AudioLevelEvent {
  amplitude: number;
}

export default function AudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [status, setStatus] = useState('Ready');
  const [deviceName, setDeviceName] = useState<string>('');
  const [devices, setDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(() => localStorage.getItem('selectedDevice') || '');
  const [modelPath, setModelPath] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [language, setLanguage] = useState('ja');
  const [ollamaModel, setOllamaModel] = useState(() => localStorage.getItem('ollamaModel') || '');
  const [ollamaPrompt, setOllamaPrompt] = useState(() => localStorage.getItem('ollamaPrompt') ||
    "以下の文章の『えー』『あの』などのフィラーを取り除き、句読点を適切に補って、自然な日本語の文章に修正してください。出力は修正後の文章のみにしてください。\n\n対象の文章: {text}"
  );
  const [refinedText, setRefinedText] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Refs for accessing state in event listeners
  const isRecordingRef = useRef(isRecording);
  const selectedDeviceRef = useRef(selectedDevice);
  const ollamaModelRef = useRef(ollamaModel);
  const ollamaPromptRef = useRef(ollamaPrompt);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  useEffect(() => {
    ollamaModelRef.current = ollamaModel;
    ollamaPromptRef.current = ollamaPrompt;
    localStorage.setItem('ollamaModel', ollamaModel);
    localStorage.setItem('ollamaPrompt', ollamaPrompt);
  }, [ollamaModel, ollamaPrompt]);

  useEffect(() => {
    localStorage.setItem('selectedDevice', selectedDevice);
  }, [selectedDevice]);

  const startRecording = async () => {
    try {
      await invoke('set_window_mode', { mode: 'compact' });
      const device = await invoke<string>('start_recording', {
        deviceName: selectedDeviceRef.current || null,
      });
      setIsRecording(true);
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
      // 1. Stop Recording
      const path = await invoke<string>('stop_recording');
      setIsRecording(false);
      setAudioLevel(0);
      setStatus('Transcribing...');

      // Restore normal window logic
      await invoke('set_window_mode', { mode: 'normal' });

      // 2. Transcribe
      const text = await invoke<string>('transcribe_audio', { language: 'ja' }); // Default to JA for now or add state
      setTranscription(text);

      let finalText = text;

      // 3. Refine (if model selected)
      if (ollamaModelRef.current) {
        setStatus('Refining...');
        finalText = await invoke<string>('refine_text_with_ollama', {
          text: text,
          model: ollamaModelRef.current,
          prompt: ollamaPromptRef.current
        });
        setRefinedText(finalText);
      }

      // 4. Copy to Clipboard
      await invoke('copy_to_clipboard', { text: finalText });
      setStatus('Copied to clipboard!');

      // 5. Notify
      sendNotification({
        title: 'OpenSW',
        body: 'Transcription copied to clipboard',
      });

    } catch (error) {
      console.error('Pipeline failed:', error);
      setStatus(`Pipeline Error: ${error}`);
      await invoke('set_window_mode', { mode: 'normal' });
    }
  };

  const stopRecording = async () => {
    await stopAndProcess();
  };

  useEffect(() => {
    const unlistenAudioLevel = listen<AudioLevelEvent>('audio-level-update', (event) => {
      setAudioLevel(event.payload.amplitude);
    });

    // Listen for global shortcut toggle-recording event
    const unlistenToggle = listen('toggle-recording', async () => {
      if (!isRecordingRef.current) {
        // Start recording
        startRecording();
      } else {
        // Stop recording and run pipeline
        stopAndProcess();
      }
    });

    // Fetch devices
    invoke<string[]>('get_input_devices').then(setDevices).catch(console.error);

    return () => {
      unlistenAudioLevel.then((f) => f());
      unlistenToggle.then((f) => f());
    };
  }, []); // Empty dependency array, relying on refs

  const playRecording = async () => {
    try {
      setIsPlaying(true);
      setStatus('Playing...');
      await invoke('play_recording');
      setIsPlaying(false);
      setStatus('Playback finished');
    } catch (error) {
      console.error('Failed to play recording:', error);
      setIsPlaying(false);
      setStatus(`Error: ${error}`);
    }
  };

  const selectModel = async () => {
    try {
      const path = await invoke<string>('select_model');
      setModelPath(path);
      setStatus(`Model selected: ${path}`);
    } catch (error) {
      console.error('Failed to select model:', error);
      setStatus(`Error: ${error}`);
    }
  };

  const transcribeAudio = async () => {
    try {
      setIsTranscribing(true);
      setStatus('Transcribing...');
      const text = await invoke<string>('transcribe_audio', { language });
      setTranscription(text);
      setStatus('Transcription complete');
    } catch (error) {
      console.error('Failed to transcribe:', error);
      setStatus(`Error: ${error}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const refineText = async () => {
    if (!transcription || !ollamaModel) return;
    try {
      setIsRefining(true);
      setStatus('Refining text...');
      const refined = await invoke<string>('refine_text_with_ollama', {
        text: transcription,
        model: ollamaModel,
        prompt: ollamaPrompt,
      });
      setRefinedText(refined);
      setStatus('Refinement complete');
    } catch (error) {
      console.error('Failed to refine text:', error);
      setStatus(`Error: ${error}`);
    } finally {
      setIsRefining(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await invoke('copy_to_clipboard', { text });
      setStatus('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      setStatus(`Error: ${error}`);
    }
  };

  if (isRecording) {
    return (
      <RecordingStatus
        status={status}
        onStop={() => {
          invoke('request_toggle_recording').catch(console.error);
        }}
      />
    );
  }

  return (
    <div
      style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginTop: '20px' }}
    >
      <h1>AI Voice Assistant (Phase 1)</h1>
      <h2>Audio Recorder</h2>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ marginRight: '10px' }}>Input Device:</label>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          disabled={isRecording}
          style={{ padding: '5px', borderRadius: '4px' }}
        >
          <option value="">Default</option>
          {devices.map((device) => (
            <option key={device} value={device}>
              {device}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        Status: <strong>{status}</strong>
      </div>
      {deviceName && (
        <div style={{ marginBottom: '10px', fontSize: '0.9em', color: '#666' }}>
          Active Device: {deviceName}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={startRecording} disabled={isRecording || isPlaying}>
          Record
        </button>
        <button onClick={stopRecording} disabled={!isRecording}>
          Stop
        </button>
        <button onClick={playRecording} disabled={isRecording || isPlaying}>
          Play
        </button>
      </div>

      <div
        style={{
          width: '100%',
          height: '20px',
          backgroundColor: '#eee',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(audioLevel * 100, 100)}%`,
            height: '100%',
            backgroundColor: isRecording ? '#ff4444' : '#4444ff',
            transition: 'width 0.1s ease-out',
          }}
        />
      </div>

      <OllamaSettings
        selectedModel={ollamaModel}
        onModelChange={setOllamaModel}
        prompt={ollamaPrompt}
        onPromptChange={setOllamaPrompt}
      />

      <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
        <h3>Transcription & Refinement</h3>

        <div style={{ marginBottom: '10px' }}>
          <button onClick={selectModel} disabled={isRecording || isTranscribing}>
            Select Whisper Model
          </button>
          <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '10px' }}>
            {modelPath ? `Model: ${modelPath}` : 'No model selected'}
          </span>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ marginRight: '10px' }}>Language:</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isTranscribing}
            style={{ padding: '5px', borderRadius: '4px' }}
          >
            <option value="ja">Japanese</option>
            <option value="en">English</option>
          </select>

          <button
            onClick={transcribeAudio}
            disabled={!modelPath || isRecording || isPlaying || isTranscribing}
            style={{ marginLeft: '10px' }}
          >
            {isTranscribing ? 'Transcribing...' : 'Transcribe Recording'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
          <div style={{ flex: 1 }}>
            <h4>Raw Transcription</h4>
            <textarea
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              placeholder="Transcription will appear here..."
              style={{ width: '100%', height: '200px', padding: '10px', resize: 'vertical' }}
            />
            <div style={{ marginTop: '5px' }}>
              <button onClick={() => copyToClipboard(transcription)} disabled={!transcription}>Copy Raw</button>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <h4>Refined Text</h4>
            <textarea
              value={refinedText}
              onChange={(e) => setRefinedText(e.target.value)}
              placeholder="Refined text will appear here..."
              style={{ width: '100%', height: '200px', padding: '10px', resize: 'vertical' }}
            />
            <div style={{ marginTop: '5px', display: 'flex', gap: '10px' }}>
              <button
                onClick={refineText}
                disabled={!transcription || !ollamaModel || isRefining}
              >
                {isRefining ? 'Refining...' : 'Refine with Ollama'}
              </button>
              <button onClick={() => copyToClipboard(refinedText)} disabled={!refinedText}>Copy Refined</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
