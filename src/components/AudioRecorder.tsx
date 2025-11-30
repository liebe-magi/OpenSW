import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

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

      <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
        <h3>Transcription</h3>
        <div style={{ marginBottom: '10px' }}>
          <button onClick={selectModel} disabled={isRecording || isTranscribing}>
            Select Whisper Model
          </button>
          <div style={{ fontSize: '0.8em', color: '#666', marginTop: '5px' }}>
            {modelPath ? `Model: ${modelPath}` : 'No model selected'}
          </div>
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
        </div>

        <div style={{ marginBottom: '10px' }}>
          <button
            onClick={transcribeAudio}
            disabled={!modelPath || isRecording || isPlaying || isTranscribing}
          >
            {isTranscribing ? 'Transcribing...' : 'Transcribe Recording'}
          </button>
        </div>

        <textarea
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          placeholder="Transcription will appear here..."
          style={{ width: '100%', height: '100px', padding: '10px' }}
        />
      </div>
    </div>
  );
}
