type PipelineStage = 'recording' | 'transcribing' | 'refining' | 'copying' | 'done';

interface CompactStatusProps {
  stage: PipelineStage;
  onStop: () => void;
}

const stageConfig: Record<PipelineStage, { color: string; text: string; bgGlow: string }> = {
  recording: { color: '#ff4d4d', text: 'Recording', bgGlow: 'rgba(255, 77, 77, 0.15)' },
  transcribing: { color: '#ffcc00', text: 'Transcribing', bgGlow: 'rgba(255, 204, 0, 0.15)' },
  refining: { color: '#4da6ff', text: 'Refining', bgGlow: 'rgba(77, 166, 255, 0.15)' },
  copying: { color: '#4dff88', text: 'Copying', bgGlow: 'rgba(77, 255, 136, 0.15)' },
  done: { color: '#4dff88', text: 'Copied!', bgGlow: 'rgba(77, 255, 136, 0.2)' },
};

export default function RecordingStatus({ stage, onStop }: CompactStatusProps) {
  const pulse = stage !== 'done';
  const config = stageConfig[stage];

  return (
    <div
      className="compact-status"
      style={{
        background: `linear-gradient(135deg, ${config.bgGlow} 0%, rgba(15, 15, 18, 0.98) 100%)`,
      }}
    >
      <div className="status-content">
        <div className="indicator-container">
          <div
            className={`indicator ${pulse ? 'pulsing' : ''}`}
            style={{ backgroundColor: config.color, boxShadow: `0 0 12px ${config.color}` }}
          />
        </div>
        <span className="status-text" style={{ color: config.color }}>
          {config.text}
        </span>
      </div>
      <button
        onClick={onStop}
        className={`stop-button ${stage !== 'recording' ? 'disabled' : ''}`}
        disabled={stage !== 'recording'}
      >
        Stop
      </button>
      <style>{`
        .compact-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          color: #f0f0f5;
          font-family: 'Inter', system-ui, sans-serif;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          border-radius: 0;
        }
        .status-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .indicator-container {
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transition: all 0.3s ease;
        }
        .indicator.pulsing {
          animation: pulse-glow 1.5s ease-in-out infinite;
        }
        .status-text {
          font-weight: 600;
          font-size: 1.1em;
          letter-spacing: 0.02em;
          min-width: 120px;
        }
        .stop-button {
          background: linear-gradient(135deg, #ff4d4d 0%, #cc0000 100%);
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9em;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(255, 77, 77, 0.3);
        }
        .stop-button:hover:not(.disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 77, 77, 0.4);
        }
        .stop-button.disabled {
          background: #3a3a45;
          cursor: not-allowed;
          opacity: 0.6;
          box-shadow: none;
        }
        @keyframes pulse-glow {
          0%, 100% { 
            transform: scale(1); 
            opacity: 1;
          }
          50% { 
            transform: scale(1.2); 
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}
