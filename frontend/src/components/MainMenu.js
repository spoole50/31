import React, { useState } from 'react';
import './MainMenu.css';

const MainMenu = ({ onLocalGame, onOnlineGame, onShowRules }) => {
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [showOnlineForm, setShowOnlineForm] = useState(false);

  const generatePlayerId = () => {
    return 'player_' + Math.random().toString(36).substr(2, 9);
  };

  const handleOnlineGameClick = () => {
    if (showOnlineForm) {
      if (!playerName.trim()) {
        alert('Please enter your name');
        return;
      }
      
      const id = playerId || generatePlayerId();
      setPlayerId(id);
      onOnlineGame(id, playerName.trim());
    } else {
      setShowOnlineForm(true);
    }
  };

  const handleLocalGameClick = () => {
    onLocalGame();
  };

  return (
    <div className="main-menu">
      <div className="menu-container">
        <header className="game-title">
          <h1>31</h1>
          <p>Build the highest same-suit hand. Last player standing wins.</p>
        </header>

        <div className="menu-options">
          <div className="mode-options">

            <div className="mode-option local-mode">
              <div className="mode-suit">♠</div>
              <div className="mode-content">
                <h3>Local Game</h3>
                <p>Play against AI opponents — no setup needed.</p>
              </div>
              <button
                onClick={handleLocalGameClick}
                className="btn btn-primary mode-button"
              >
                Play Now
              </button>
            </div>

            <div className="mode-option online-mode">
              <div className="mode-suit">♣</div>
              <div className="mode-content">
                <h3>Online Multiplayer</h3>
                <p>Create or join a table with friends.</p>
              </div>

              {!showOnlineForm ? (
                <button
                  onClick={handleOnlineGameClick}
                  className="btn btn-primary mode-button"
                >
                  Play Online
                </button>
              ) : (
                <div className="online-form">
                  <div className="form-group">
                    <label htmlFor="playerName">Your name</label>
                    <input
                      id="playerName"
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter your name"
                      maxLength={20}
                      autoFocus
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleOnlineGameClick();
                      }}
                    />
                  </div>
                  <div className="form-buttons">
                    <button
                      onClick={handleOnlineGameClick}
                      className="btn btn-primary mode-button"
                      disabled={!playerName.trim()}
                    >
                      Enter Lobby
                    </button>
                    <button
                      onClick={() => setShowOnlineForm(false)}
                      className="btn btn-secondary cancel-button"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="menu-footer">
            <button onClick={onShowRules} className="btn btn-ghost rules-button">
              Game Rules
            </button>
            <p className="quick-rules">
              Aces&nbsp;= 11 &nbsp;·&nbsp; Face cards&nbsp;= 10 &nbsp;·&nbsp; 3 of a kind Aces or 31 in one suit&nbsp;= instant win
            </p>
            <a
              href="https://github.com/spoole50"
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
            >
              <svg height="16" viewBox="0 0 16 16" width="16" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                  0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                  -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                  .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                  -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
                  1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
                  1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
                  1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
              spoole50
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
