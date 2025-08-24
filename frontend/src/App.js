import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import axios from 'axios';
import GameBoard from './components/GameBoard';
import GameSetup from './components/GameSetup';
import './App.css';

const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  const [gameState, setGameState] = useState(null);
  const [currentPlayerId, setCurrentPlayerId] = useState('player_1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createGame = async (playerNames, numAiPlayers = 0) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/games`, {
        player_names: playerNames,
        num_ai_players: numAiPlayers
      });
      
      setGameState(response.data);
      // Set current player to the first human player
      const humanPlayers = Object.entries(response.data.players).filter(([id, player]) => !player.is_ai);
      if (humanPlayers.length > 0) {
        setCurrentPlayerId(humanPlayers[0][0]);
      } else {
        setCurrentPlayerId(Object.keys(response.data.players)[0]);
      }
    } catch (err) {
      setError('Failed to create game: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const refreshGameState = async () => {
    if (!gameState?.game_id) return;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/games/${gameState.game_id}`);
      setGameState(response.data);
      
      // Check if it's an AI player's turn and automatically play their turn
      const currentPlayer = response.data.players[response.data.current_player_id];
      if (currentPlayer && currentPlayer.is_ai && response.data.phase !== 'finished') {
        setTimeout(() => {
          playAITurn(response.data.game_id);
        }, 1000); // Delay to make AI moves visible
      }
    } catch (err) {
      setError('Failed to refresh game state');
    }
  };

  const playAITurn = async (gameId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/games/${gameId}/ai-turn`, {});
      setGameState(response.data);
      
      // Check if next player is also AI
      const nextCurrentPlayer = response.data.players[response.data.current_player_id];
      if (nextCurrentPlayer && nextCurrentPlayer.is_ai && response.data.phase !== 'finished') {
        setTimeout(() => {
          playAITurn(gameId);
        }, 1000);
      }
    } catch (err) {
      console.error('AI turn failed:', err);
    }
  };

  // Auto-refresh game state and handle AI turns
  useEffect(() => {
    if (!gameState?.game_id) return;
    
    const currentPlayer = gameState.players[gameState.current_player_id];
    if (currentPlayer && currentPlayer.is_ai && gameState.phase !== 'finished') {
      const timer = setTimeout(() => {
        playAITurn(gameState.game_id);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const drawCard = async (fromDiscard = false) => {
    if (!gameState?.game_id) return;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/games/${gameState.game_id}/draw`, {
        game_id: gameState.game_id,
        player_id: currentPlayerId,
        from_discard: fromDiscard
      });
      
      setGameState(response.data);
    } catch (err) {
      setError('Failed to draw card: ' + (err.response?.data?.detail || err.message));
    }
  };

  const discardCard = async (cardIndex) => {
    if (!gameState?.game_id) return;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/games/${gameState.game_id}/discard`, {
        game_id: gameState.game_id,
        player_id: currentPlayerId,
        card_index: cardIndex
      });
      
      setGameState(response.data);
    } catch (err) {
      setError('Failed to discard card: ' + (err.response?.data?.detail || err.message));
    }
  };

  const knockGame = async () => {
    if (!gameState?.game_id) return;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/games/${gameState.game_id}/knock`, {
        game_id: gameState.game_id,
        player_id: currentPlayerId
      });
      
      setGameState(response.data);
    } catch (err) {
      setError('Failed to knock: ' + (err.response?.data?.detail || err.message));
    }
  };

  const resetGame = () => {
    setGameState(null);
    setCurrentPlayerId('player_1');
    setError(null);
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  // Helper functions to determine if actions are allowed
  const canDrawCard = () => {
    if (!gameState || !currentPlayerId) return false;
    
    // Check if it's current player's turn
    if (currentPlayerId !== gameState.current_player_id) return false;
    
    // Check if game is in playing state
    if (!['playing', 'final_round'].includes(gameState.phase)) return false;
    
    const currentPlayer = gameState.players[currentPlayerId];
    if (!currentPlayer || currentPlayer.is_eliminated) return false;
    
    // Can draw if player has exactly 3 cards
    return currentPlayer.hand.length === 3;
  };

  const canDiscardCard = () => {
    if (!gameState || !currentPlayerId) return false;
    
    // Check if it's current player's turn
    if (currentPlayerId !== gameState.current_player_id) return false;
    
    // Check if game is in playing state
    if (!['playing', 'final_round'].includes(gameState.phase)) return false;
    
    const currentPlayer = gameState.players[currentPlayerId];
    if (!currentPlayer || currentPlayer.is_eliminated) return false;
    
    // Can discard if player has exactly 4 cards
    return currentPlayer.hand.length === 4;
  };

  const canKnock = () => {
    if (!gameState || !currentPlayerId) return false;
    
    // Check if it's current player's turn
    if (currentPlayerId !== gameState.current_player_id) return false;
    
    // Check if game is in playing state
    if (!['playing', 'final_round'].includes(gameState.phase)) return false;
    
    const currentPlayer = gameState.players[currentPlayerId];
    if (!currentPlayer || currentPlayer.is_eliminated) return false;
    
    // Can knock if player has exactly 3 cards and hasn't knocked yet
    return currentPlayer.hand.length === 3 && !currentPlayer.has_knocked;
  };

  if (!gameState) {
    return (
      <div className="app">
        <div className="header">
          <h1>31 Card Game</h1>
        </div>
        <GameSetup onCreateGame={createGame} error={error} />
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="app">
        <div className="header">
          <h1>31 Card Game</h1>
          <div className="game-info">
            <span>Round: {gameState.round_number}</span>
            <span>Phase: {gameState.phase}</span>
            {gameState.winner_id && (
              <span className="winner">
                Winner: {gameState.players[gameState.winner_id]?.name}
              </span>
            )}
          </div>
          <div className="player-selector">
            <label>
              Playing as: 
              <select 
                value={currentPlayerId} 
                onChange={(e) => setCurrentPlayerId(e.target.value)}
              >
                {Object.entries(gameState.players)
                  .filter(([id, player]) => !player.is_ai)
                  .map(([id, player]) => (
                    <option key={id} value={id}>{player.name}</option>
                  ))}
              </select>
            </label>
          </div>
          <button onClick={resetGame} className="btn btn-secondary">
            New Game
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <GameBoard
          gameState={gameState}
          currentPlayerId={currentPlayerId}
          onDrawCard={drawCard}
          onDiscardCard={discardCard}
          onKnock={knockGame}
          onRefresh={refreshGameState}
          canDrawCard={canDrawCard()}
          canDiscardCard={canDiscardCard()}
          canKnock={canKnock()}
        />
      </div>
    </DndProvider>
  );
}

export default App;
