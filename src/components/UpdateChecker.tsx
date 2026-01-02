import { useState, useCallback } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'error';

export default function UpdateChecker() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    setStatus('checking');
    setError(null);
    try {
      const updateInfo = await check();
      if (updateInfo) {
        setUpdate(updateInfo);
        setStatus('available');
      } else {
        setStatus('idle');
        setError('No updates available');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!update) return;

    setStatus('downloading');
    setProgress(0);

    try {
      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setStatus('installing');
            break;
        }
      });

      await relaunch();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [update]);

  return (
    <div className="update-checker">
      {status === 'idle' && (
        <button onClick={checkForUpdate} className="update-btn">
          Check for Updates
        </button>
      )}

      {status === 'checking' && <span className="update-status">Checking...</span>}

      {status === 'available' && update && (
        <div className="update-available">
          <span>v{update.version} available</span>
          <button onClick={downloadAndInstall} className="update-btn primary">
            Update Now
          </button>
        </div>
      )}

      {status === 'downloading' && (
        <div className="update-progress">
          <span>Downloading... {progress}%</span>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {status === 'installing' && <span className="update-status">Installing...</span>}

      {status === 'error' && (
        <div className="update-error">
          <span>{error}</span>
          <button onClick={checkForUpdate} className="update-btn">
            Retry
          </button>
        </div>
      )}

      <style>{`
        .update-checker {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
        }
        .update-btn {
          background: rgba(100, 108, 255, 0.15);
          border: 1px solid rgba(100, 108, 255, 0.3);
          color: #a0a8ff;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 0.85em;
          cursor: pointer;
          transition: all 0.2s;
        }
        .update-btn:hover {
          background: rgba(100, 108, 255, 0.25);
          border-color: #646cff;
        }
        .update-btn.primary {
          background: linear-gradient(135deg, #646cff 0%, #535bf2 100%);
          border: none;
          color: white;
          font-weight: 600;
        }
        .update-btn.primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(100, 108, 255, 0.3);
        }
        .update-status {
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.6);
        }
        .update-available {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85em;
          color: #4dff88;
        }
        .update-progress {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.6);
        }
        .progress-bar {
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #646cff, #9f5afd);
          transition: width 0.2s;
        }
        .update-error {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85em;
          color: #ff6b6b;
        }
      `}</style>
    </div>
  );
}
