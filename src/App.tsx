import './App.css';
import AudioRecorder from './components/AudioRecorder';
import RecordingStatus from './components/RecordingStatus';
import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

function App() {


  return (
    <div className="container">
      <AudioRecorder />
    </div>
  );
}

export default App;
