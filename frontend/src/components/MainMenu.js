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
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
