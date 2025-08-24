import React, { useState } from 'react';

function GameSetup({ onCreateGame, error }) {
  const [playerNames, setPlayerNames] = useState(['Player 1']);
  const [numAiPlayers, setNumAiPlayers] = useState(1);

  const addPlayer = () => {
    if (playerNames.length < 8) {
      setPlayerNames([...playerNames, `Player ${playerNames.length + 1}`]);
    }
  };

  const removePlayer = (index) => {
    if (playerNames.length > 1) {
      const newNames = playerNames.filter((_, i) => i !== index);
      setPlayerNames(newNames);
    }
  };

  const updatePlayerName = (index, name) => {
    const newNames = [...playerNames];
    newNames[index] = name;
    setPlayerNames(newNames);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate total players
    const totalPlayers = playerNames.length + numAiPlayers;
    if (totalPlayers < 2 || totalPlayers > 8) {
      alert('Total players must be between 2 and 8');
      return;
    }

    // Validate player names
    const validNames = playerNames.filter(name => name.trim().length > 0);
    if (validNames.length !== playerNames.length) {
      alert('All player names must be filled');
      return;
    }

    onCreateGame(validNames, numAiPlayers);
  };

  return (
    <div className="game-setup">
      <div className="setup-container">
        <h2>Setup New Game</h2>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="section">
            <h3>Human Players ({playerNames.length})</h3>
            {playerNames.map((name, index) => (
              <div key={index} className="player-input">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => updatePlayerName(index, e.target.value)}
                  placeholder={`Player ${index + 1} name`}
                  required
                />
                {playerNames.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePlayer(index)}
                    className="btn btn-danger btn-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            
            {playerNames.length < 8 && (
              <button
                type="button"
                onClick={addPlayer}
                className="btn btn-secondary"
              >
                Add Human Player
              </button>
            )}
          </div>

          <div className="section">
            <h3>AI Players</h3>
            <div className="ai-players-input">
              <label>
                Number of AI players:
                <select
                  value={numAiPlayers}
                  onChange={(e) => setNumAiPlayers(parseInt(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="section">
            <div className="game-summary">
              <p><strong>Total Players:</strong> {playerNames.length + numAiPlayers}</p>
              <p><strong>Human Players:</strong> {playerNames.length}</p>
              <p><strong>AI Players:</strong> {numAiPlayers}</p>
            </div>
          </div>

          <div className="section">
            <button 
              type="submit" 
              className="btn btn-primary btn-large"
              disabled={playerNames.length + numAiPlayers < 2 || playerNames.length + numAiPlayers > 8}
            >
              Start Game
            </button>
          </div>
        </form>

        <div className="rules-summary">
          <h3>Game Rules Summary</h3>
          <ul>
            <li>Goal: Get the highest total value in the same suit</li>
            <li>Perfect score: 31 points (automatic win)</li>
            <li>Three Aces also count as 31</li>
            <li>Each player starts with 3 lives</li>
            <li>Lowest score each round loses a life</li>
            <li>Last player standing wins!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default GameSetup;
