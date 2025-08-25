import React, { useEffect, useRef } from 'react';
import './GameLog.css';

const GameLog = ({ gameLog, isVisible = true }) => {
  const logRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [gameLog]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="game-log">
      <div className="game-log-header">
        <h3>🎮 Game Log</h3>
      </div>
      <div className="game-log-content" ref={logRef}>
        {gameLog && Array.isArray(gameLog) && gameLog.length > 0 ? (
          <div className="log-messages">
            {gameLog.map((message, index) => (
              <div key={index} className="log-message">
                <span className="log-text">{message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="log-empty">
            <span>Game will start soon...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameLog;
