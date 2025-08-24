import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GameBoard from './GameBoard';
import './TableGameBoard.css';

const API_BASE_URL = 'http://localhost:8000/api';

const TableGameBoard = ({ tableId, playerId, playerName, onBackToLobby, onGameEnd }) => {
  const [gameState, setGameState] = useState(null);
  const [tableInfo, setTableInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentGamePlayerId, setCurrentGamePlayerId] = useState(null);

  useEffect(() => {
    // Load initial game state
    loadGameState();
    
    // Poll for game updates
    const interval = setInterval(() => {
      loadGameState();
    }, 2000); // Refresh every 2 seconds
    
    return () => clearInterval(interval);
  }, [tableId]);

  const loadGameState = async () => {
    try {
      // Get table info
      const tableResponse = await axios.get(`${API_BASE_URL}/tables/${tableId}`);
      setTableInfo(tableResponse.data);
      
      // Get game state if game is active
      if (tableResponse.data.status === 'playing') {
        try {
          const gameResponse = await axios.get(`${API_BASE_URL}/tables/${tableId}/game`);
          const gameData = gameResponse.data;
          setGameState(gameData);
          
          // Find the current player's game ID by matching name
          const tablePlayer = tableResponse.data.players.find(p => p.id === playerId);
          if (tablePlayer && gameData.players) {
            const gamePlayer = Object.entries(gameData.players).find(([_, player]) => 
              player.name === tablePlayer.name
            );
            if (gamePlayer) {
              setCurrentGamePlayerId(gamePlayer[0]);
            }
          }
        } catch (gameErr) {
          console.error('Failed to get game state:', gameErr);
          setError('Game state not available: ' + (gameErr.response?.data?.error || gameErr.message));
          // Don't redirect back, let user try to refresh
        }
      } else {
        // Game finished or table not in playing state
        if (tableResponse.data.status === 'finished') {
          onGameEnd(tableResponse.data);
        } else if (tableResponse.data.status === 'waiting' || tableResponse.data.status === 'ready') {
          // Game hasn't started yet, go back to lobby
          onBackToLobby();
        }
      }
      
      setLoading(false);
    } catch (err) {
      setError('Failed to load game state: ' + (err.response?.data?.error || err.message));
      setLoading(false);
    }
  };

  const performGameAction = async (action, data = {}) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/tables/${tableId}/game/${action}`,
        {
          player_id: playerId,
          ...data
        }
      );
      
      setGameState(response.data);
      return true;
    } catch (err) {
      setError('Action failed: ' + (err.response?.data?.error || err.message));
      return false;
    }
  };

  const handleDrawCard = async (fromDiscard = false) => {
    return await performGameAction('draw', { from_discard: fromDiscard });
  };

  const handleDiscardCard = async (cardIndex) => {
    return await performGameAction('discard', { card_index: cardIndex });
  };

  const handleKnock = async () => {
    return await performGameAction('knock');
  };

  const handleAITurn = async () => {
    return await performGameAction('ai-turn');
  };

  const handleRefresh = () => {
    loadGameState();
  };

  if (loading) {
    return (
      <div className="table-game-loading">
        <div className="loading-spinner"></div>
        <p>Loading game...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="table-game-error">
        <h3>Error</h3>
        <p>{error}</p>
        <div className="error-actions">
          <button onClick={loadGameState}>Retry</button>
          <button onClick={onBackToLobby}>Back to Lobby</button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="table-game-waiting">
        <h3>Game Not Available</h3>
        <p>The game is not currently active.</p>
        <button onClick={onBackToLobby}>Back to Lobby</button>
      </div>
    );
  }

  // Check if current player is AI and auto-play
  const currentPlayer = gameState.players[gameState.current_player_id];
  const isCurrentPlayerAI = currentPlayer && currentPlayer.is_ai;

  return (
    <div className="table-game-board">
      <div className="table-game-header">
        <div className="table-info">
          <h3>{tableInfo?.table_name}</h3>
          <span>Round {gameState.round_number}</span>
        </div>
        
        <div className="game-controls">
          {isCurrentPlayerAI && (
            <button 
              onClick={handleAITurn}
              className="ai-turn-btn"
              disabled={loading}
            >
              Process AI Turn
            </button>
          )}
          
          <button onClick={handleRefresh} className="refresh-btn">
            Refresh
          </button>
          
          <button onClick={onBackToLobby} className="back-to-lobby-btn">
            Back to Lobby
          </button>
        </div>
      </div>

      {error && (
        <div className="game-error-banner">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <GameBoard
        gameState={gameState}
        currentPlayerId={currentGamePlayerId}
        onDrawCard={handleDrawCard}
        onDiscardCard={handleDiscardCard}
        onKnock={handleKnock}
        onRefresh={handleRefresh}
      />

      {gameState.phase === 'finished' && (
        <div className="game-finished-overlay">
          <div className="game-finished-content">
            <h2>Game Finished!</h2>
            
            {gameState.winner_id && (
              <div className="winner-announcement">
                <h3>Winner: {gameState.players[gameState.winner_id]?.name}</h3>
              </div>
            )}
            
            <div className="final-scores">
              <h4>Final Scores</h4>
              {Object.entries(gameState.players)
                .filter(([_, player]) => !player.is_eliminated)
                .map(([playerId, player]) => {
                  const [score, suit] = player.calculate_best_score ? 
                    player.calculate_best_score() : [0, ''];
                  return (
                    <div key={playerId} className="final-score">
                      <span className="player-name">{player.name}</span>
                      <span className="player-score">{score} ({suit})</span>
                      <span className="player-lives">{player.lives} lives</span>
                    </div>
                  );
                })}
            </div>
            
            <div className="game-finished-actions">
              <button onClick={onBackToLobby} className="back-to-lobby-btn">
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableGameBoard;
