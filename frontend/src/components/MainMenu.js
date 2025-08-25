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
        <div className="game-title">
          <h1>31</h1>
          <p>The classic card game where getting closest to 31 wins!</p>
        </div>

        <div className="menu-options">
          <div className="game-mode-section">
            <h2>Choose Game Mode</h2>
            
            <div className="mode-options">
              <div className="mode-option local-mode">
                <div className="mode-content">
                  <h3>🎮 Local Game</h3>
                  <p>Play immediately with AI opponents</p>
                  <ul>
                    <li>Quick start</li>
                    <li>Multiple AI difficulty levels</li>
                    <li>No internet required</li>
                  </ul>
                </div>
                <button 
                  onClick={handleLocalGameClick}
                  className="btn btn-primary mode-button"
                >
                  Start Local Game
                </button>
              </div>

              <div className="mode-option online-mode">
                <div className="mode-content">
                  <h3>🌐 Online Multiplayer</h3>
                  <p>Create or join tables with other players</p>
                  <ul>
                    <li>Play with friends</li>
                    <li>Create private tables</li>
                    <li>Join public games</li>
                    <li>Mix human & AI players</li>
                  </ul>
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
                      <label htmlFor="playerName">Your Name:</label>
                      <input
                        id="playerName"
                        type="text"
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        placeholder="Enter your name"
                        maxLength={20}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleOnlineGameClick();
                          }
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
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="additional-options">
            <button onClick={onShowRules} className="btn btn-ghost rules-button">
              📖 Game Rules
            </button>
          </div>
        </div>

        <div className="game-info">
          <div className="info-section">
            <h4>How to Play</h4>
            <p>
              Draw and discard cards to get as close to 31 points as possible in a single suit. 
              Face cards are worth 10, Aces are worth 11, and number cards are face value.
            </p>
          </div>
          
          <div className="info-section">
            <h4>Winning</h4>
            <p>
              Get exactly 31 points for an instant win, or have the highest score when someone knocks. 
              The lowest score loses a life. Last player standing wins!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
