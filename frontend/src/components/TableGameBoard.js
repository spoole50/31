import React, { useState, useEffect } from 'react';
import axios from 'axios';
import GameBoard from './GameBoard';
import './TableGameBoard.css';

const API_BASE_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api`;

const TableGameBoard = ({ tableId, playerId, playerName, onBackToLobby, onGameEnd }) => {
  const [gameState, setGameState] = useState(null);
  const [tableInfo, setTableInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentGamePlayerId, setCurrentGamePlayerId] = useState(null);
  const [localTurnTimeRemaining, setLocalTurnTimeRemaining] = useState(45);

  useEffect(() => {
    // Load initial game state
    loadGameState();
    
    // Poll for game updates - reduced interval for better responsiveness
    const interval = setInterval(() => {
      loadGameState();
    }, 1000); // Refresh every 1 second for more responsive updates
    
    return () => clearInterval(interval);
  }, [tableId]);

  // Local timer that updates every second for smooth countdown
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setLocalTurnTimeRemaining(prev => {
        if (prev > 0) {
          return prev - 1;
        }
        return 0;
      });
    }, 1000);
    
    return () => clearInterval(timerInterval);
  }, []);

  // Sync local timer with server timer when game state updates
  useEffect(() => {
    if (gameState && gameState.turn_time_remaining !== undefined) {
      setLocalTurnTimeRemaining(gameState.turn_time_remaining);
    }
  }, [gameState?.turn_time_remaining, gameState?.current_player_id]);

  const formatTurnTimer = (timeRemaining) => {
    if (timeRemaining <= 0) return '0:00';
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTurnTimerColor = (timeRemaining) => {
    if (timeRemaining <= 10) return '#ff4444'; // Red for last 10 seconds
    if (timeRemaining <= 20) return '#ff8800'; // Orange for last 20 seconds
    return '#ffd700'; // Gold for normal time
  };

  const loadGameState = async () => {
    try {
      // Get table info
      const tableResponse = await axios.get(`${API_BASE_URL}/tables/${tableId}`);
      setTableInfo(tableResponse.data);
      
      // Get game state if game is active or finished
      if (tableResponse.data.status === 'playing' || tableResponse.data.status === 'finished') {
        try {
          const gameResponse = await axios.get(`${API_BASE_URL}/tables/${tableId}/game?player_id=${playerId}`);
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
        // Game hasn't started yet or other status, go back to lobby
        if (tableResponse.data.status === 'waiting' || tableResponse.data.status === 'ready') {
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
      
      // Force immediate refresh to ensure we have the latest state
      // This is especially important for life tracking and game state changes
      setTimeout(() => {
        loadGameState();
      }, 500); // Small delay to allow server to fully process
      
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

  const handlePlayAgain = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${API_BASE_URL}/tables/${tableId}/restart`,
        {
          host_id: playerId
        }
      );
      
      // Restart successful - table should now be in waiting status
      // The loadGameState function will detect this and redirect to lobby
      console.log('Game restarted successfully, redirecting to lobby...');
      
      // Force immediate reload to trigger the lobby redirect
      await loadGameState();
      
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      if (errorMsg.includes('Can only restart finished games')) {
        setError('This game cannot be restarted right now.');
      } else if (errorMsg.includes('not host')) {
        setError('Only the host can restart the game.');
      } else {
        setError('Failed to restart game: ' + errorMsg);
      }
    } finally {
      setLoading(false);
    }
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
          
          <div className="back-to-lobby-container">
            <button onClick={onBackToLobby} className="back-to-lobby-btn">
              Back to Lobby
            </button>
            <div className="game-tips-hover">
              <div className="tips-icon">💡</div>
              <div className="tips-content">
                <h4>Quick Tips</h4>
                <ul>
                  <li>Try to get the highest total of cards in the same suit</li>
                  <li>31 points in one suit is an automatic win!</li>
                  <li>Three Aces also counts as 31</li>
                  <li>Knock when you think you have the best hand</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="game-error-banner">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Turn Timer */}
      {gameState.turn_time_remaining !== undefined && (
        <div className="turn-timer-container">
          <div 
            className="turn-timer" 
            style={{ color: getTurnTimerColor(localTurnTimeRemaining) }}
            data-critical={localTurnTimeRemaining <= 5}
          >
            <span className="timer-icon">⏰</span>
            <span className="timer-text">Turn Timer: {formatTurnTimer(localTurnTimeRemaining)}</span>
            {localTurnTimeRemaining <= 10 && (
              <span className="timer-warning"> ⚠️ Time running out!</span>
            )}
            {localTurnTimeRemaining <= 5 && (
              <span className="timer-critical"> 🚨 TIMEOUT IMMINENT!</span>
            )}
          </div>
        </div>
      )}

      <GameBoard
        gameState={gameState}
        currentPlayerId={currentGamePlayerId}
        onDrawCard={handleDrawCard}
        onDiscardCard={handleDiscardCard}
        onKnock={handleKnock}
        onRefresh={handleRefresh}
        turnTimeRemaining={localTurnTimeRemaining}
        hideGameOverOverlay={true}
      />

      {gameState && gameState.phase === 'finished' && (
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
              {tableInfo && tableInfo.host_id === playerId ? (
                <button 
                  onClick={handlePlayAgain} 
                  className="play-again-btn"
                  disabled={loading}
                >
                  {loading ? '🔄 Restarting...' : '🎮 Play Again'}
                </button>
              ) : (
                <div className="host-restart-info">
                  <p>🎮 Only the host can start a new game</p>
                  <p className="host-name">Host: {tableInfo?.players?.find(p => p.is_host)?.name}</p>
                </div>
              )}
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
