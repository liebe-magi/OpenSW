import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface RecordingStatusProps {
    status: string;
    onStop: () => void;
}

export default function RecordingStatus({ status, onStop }: RecordingStatusProps) {
    const [dots, setDots] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
        }, 500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="recording-status">
            <div className="status-indicator">
                <span className="icon">🎤</span>
                <span className="text">{status}{dots}</span>
            </div>
            <button onClick={onStop} className="stop-button">
                Stop
            </button>
            <style>{`
        .recording-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px;
          background: #2b2b2b;
          color: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          font-family: sans-serif;
          width: 100%;
          height: 100%;
          border: 1px solid #444;
        }
        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .icon {
          animation: pulse 1.5s infinite;
        }
        .stop-button {
          background: #ff4444;
          color: white;
          border: none;
          padding: 5px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        .stop-button:hover {
          background: #cc0000;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
        </div>
    );
}
