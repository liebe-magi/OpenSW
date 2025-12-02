import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import OllamaSettings from './OllamaSettings';

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
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [modelPath, setModelPath] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [language, setLanguage] = useState('ja');
  const [ollamaModel, setOllamaModel] = useState('');
  const [ollamaPrompt, setOllamaPrompt] = useState(
    '以下の文章の『えー』『あの』などのフィラーを取り除き、句読点を適切に補って、自然な日本語の文章に修正してください。出力は修正後の文章のみにしてください。\n\n対象の文章: {text}'
  );
  const [refinedText, setRefinedText] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  useEffect(() => {
    const unlisten = listen<AudioLevelEvent>('audio-level-update', (event) => {
      setAudioLevel(event.payload.amplitude);
    });

    // Fetch devices
    invoke<string[]>('get_input_devices').then(setDevices).catch(console.error);

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const startRecording = async () => {
    try {
      const device = await invoke<string>('start_recording', {
        deviceName: selectedDevice || null,
      });
      setIsRecording(true);
      setDeviceName(device);
      setStatus('Recording...');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setStatus(`Error: ${error}`);
    }
  };

  const stopRecording = async () => {
    try {
      const path = await invoke<string>('stop_recording');
      setIsRecording(false);
      setStatus(`Saved to: ${path}`);
      setAudioLevel(0);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setStatus(`Error: ${error}`);
    }
  };

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

  return (
    <div
      style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginTop: '20px' }}
    >
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
              <button onClick={() => copyToClipboard(transcription)} disabled={!transcription}>
                Copy Raw
              </button>
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
              <button onClick={refineText} disabled={!transcription || !ollamaModel || isRefining}>
                {isRefining ? 'Refining...' : 'Refine with Ollama'}
              </button>
              <button onClick={() => copyToClipboard(refinedText)} disabled={!refinedText}>
                Copy Refined
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
