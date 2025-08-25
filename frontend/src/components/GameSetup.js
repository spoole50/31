import React, { useState } from 'react';
import RulesModal from './RulesModal';
import './GameSetup.css';

function GameSetup({ onCreateGame, error, onBack }) {
  const [playerNames, setPlayerNames] = useState(['Player 1']);
  const [numAiPlayers, setNumAiPlayers] = useState(1);
  const [aiDifficulties, setAiDifficulties] = useState(['medium']);
  const [showRules, setShowRules] = useState(false);

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

  const updateAiDifficulty = (index, difficulty) => {
    const newDifficulties = [...aiDifficulties];
    newDifficulties[index] = difficulty;
    setAiDifficulties(newDifficulties);
  };

  const handleNumAiPlayersChange = (newNum) => {
    setNumAiPlayers(newNum);
    // Adjust difficulties array to match
    const newDifficulties = [...aiDifficulties];
    while (newDifficulties.length < newNum) {
      newDifficulties.push('medium');
    }
    while (newDifficulties.length > newNum) {
      newDifficulties.pop();
    }
    setAiDifficulties(newDifficulties);
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

    onCreateGame(validNames, numAiPlayers, aiDifficulties);
  };

  return (
    <div className="game-setup">
      <div className="setup-container">
        <h2 className="setup-title">🎰 Game Setup</h2>
        
        {error && (
          <div className="setup-error">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="section">
            <h3>Human Players</h3>
            <div className="players-list">
              {playerNames.map((name, index) => (
                <div key={index} className="player-input">
                  <label htmlFor={`player${index}`}>Player {index + 1}:</label>
                  <input
                    type="text"
                    id={`player${index}`}
                    value={name}
                    onChange={(e) => updatePlayerName(index, e.target.value)}
                    placeholder={`Enter player ${index + 1} name`}
                    required
                  />
                  {playerNames.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePlayer(index)}
                      className="remove-player-btn"
                      title="Remove player"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            {playerNames.length < 8 && (
              <button
                type="button"
                onClick={addPlayer}
                className="btn add-player-btn"
              >
                ➕ Add Human Player
              </button>
            )}
          </div>

          <div className="section">
            <h3>AI Players</h3>
            <div className="ai-players-input">
              <div className="form-group">
                <label htmlFor="numAiPlayers">Number of AI players:</label>
                <select
                  id="numAiPlayers"
                  value={numAiPlayers}
                  onChange={(e) => handleNumAiPlayersChange(parseInt(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {numAiPlayers > 0 && (
              <div className="ai-difficulties">
                <h4>AI Difficulty Levels</h4>
                {Array.from({ length: numAiPlayers }, (_, index) => (
                  <div key={index} className="ai-difficulty-input">
                    <div className="form-group">
                      <label htmlFor={`aiDifficulty${index}`}>AI Player {index + 1}:</label>
                      <select
                        id={`aiDifficulty${index}`}
                        value={aiDifficulties[index] || 'medium'}
                        onChange={(e) => updateAiDifficulty(index, e.target.value)}
                      >
                        <option value="easy">Easy 😊 - Makes some mistakes</option>
                        <option value="medium">Medium 🤔 - Balanced strategy</option>
                        <option value="hard">Hard 😠 - Smart and competitive</option>
                        <option value="expert">Expert 🤖 - Very challenging</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="section">
            <div className="game-summary">
              <p><strong>Total Players:</strong> {playerNames.length + numAiPlayers}</p>
              <p><strong>Human Players:</strong> {playerNames.length}</p>
              <p><strong>AI Players:</strong> {numAiPlayers}</p>
            </div>
          </div>

          <div className="section">
            <div className="setup-buttons">
              <button 
                type="submit" 
                className="btn btn-primary btn-large"
                disabled={playerNames.length + numAiPlayers < 2 || playerNames.length + numAiPlayers > 8}
              >
                Start Game
              </button>
              <button 
                type="button"
                onClick={() => setShowRules(true)}
                className="btn btn-secondary"
              >
                📖 View Full Rules
              </button>
              {onBack && (
                <button 
                  type="button"
                  onClick={onBack}
                  className="btn btn-secondary"
                >
                  ← Back to Menu
                </button>
              )}
            </div>
          </div>
        </form>

        <div className="rules-summary">
          <h3>Quick Rules Summary</h3>
          <ul>
            <li>Goal: Get the highest total value in the same suit</li>
            <li>Perfect score: 31 points (automatic win)</li>
            <li>Three of a kind also counts as 30 points</li>
            <li>Each player starts with 3 lives</li>
            <li>Lowest score each round loses a life</li>
            <li>Last player standing wins!</li>
          </ul>
        </div>
        
        <RulesModal 
          isOpen={showRules} 
          onClose={() => setShowRules(false)} 
        />
      </div>
    </div>
  );
}

export default GameSetup;
