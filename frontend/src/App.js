import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import axios from 'axios';
import MainMenu from './components/MainMenu';
import GameBoard from './components/GameBoard';
import GameSetup from './components/GameSetup';
import RulesModal from './components/RulesModal';
import TableLobby from './components/TableLobby';
import TableGameBoard from './components/TableGameBoard';

const API_BASE_URL = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api`;

// App states
const APP_STATES = {
  MAIN_MENU: 'main_menu',
  LOCAL_SETUP: 'local_setup',
  LOCAL_GAME: 'local_game',
  ONLINE_LOBBY: 'online_lobby',
  ONLINE_GAME: 'online_game'
};

function App() {
  const [appState, setAppState] = useState(APP_STATES.MAIN_MENU);
  const [gameState, setGameState] = useState(null);
  const [currentPlayerId, setCurrentPlayerId] = useState('player_1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRules, setShowRules] = useState(false);
  
  // Online multiplayer state
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [currentTableId, setCurrentTableId] = useState(null);

  const createLocalGame = async (playerNames, numAiPlayers = 0, aiDifficulties = []) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/games`, {
        player_names: playerNames,
        num_ai_players: numAiPlayers,
        ai_difficulties: aiDifficulties
      });
      
      setGameState(response.data);
      // Set current player to the first human player
      const humanPlayers = Object.entries(response.data.players).filter(([id, player]) => !player.is_ai);
      if (humanPlayers.length > 0) {
        setCurrentPlayerId(humanPlayers[0][0]);
      } else {
        setCurrentPlayerId(Object.keys(response.data.players)[0]);
      }
      
      setAppState(APP_STATES.LOCAL_GAME);
    } catch (err) {
      setError('Failed to create game: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const refreshLocalGameState = async () => {
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

  // Auto-refresh local game state and handle AI turns
  useEffect(() => {
    if (appState !== APP_STATES.LOCAL_GAME || !gameState?.game_id) return;
    
    const currentPlayer = gameState.players[gameState.current_player_id];
    
    // Auto-switch to the current turn's human player
    if (currentPlayer && !currentPlayer.is_ai && currentPlayerId !== gameState.current_player_id) {
      setCurrentPlayerId(gameState.current_player_id);
    }
    
    // Handle AI turns
    if (currentPlayer && currentPlayer.is_ai && gameState.phase !== 'finished') {
      const timer = setTimeout(() => {
        playAITurn(gameState.game_id);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState, currentPlayerId, appState]);

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

  // Navigation functions
  const goToMainMenu = () => {
    setAppState(APP_STATES.MAIN_MENU);
    setGameState(null);
    setCurrentPlayerId('player_1');
    setError(null);
    setPlayerId(null);
    setPlayerName('');
    setCurrentTableId(null);
  };

  const goToLocalSetup = () => {
    setAppState(APP_STATES.LOCAL_SETUP);
    setError(null);
  };

  const goToOnlineLobby = (id, name) => {
    setPlayerId(id);
    setPlayerName(name);
    setAppState(APP_STATES.ONLINE_LOBBY);
    setError(null);
  };

  const handleTableGameStart = (tableId, gameStateData) => {
    setCurrentTableId(tableId);
    setGameState(gameStateData);
    setAppState(APP_STATES.ONLINE_GAME);
  };

  const handleGameEnd = (tableData) => {
    // Game ended, go back to lobby
    setAppState(APP_STATES.ONLINE_LOBBY);
    setCurrentTableId(null);
    setGameState(null);
  };

  // Helper functions to determine if actions are allowed (for local games)
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

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  // Render different components based on app state
  switch (appState) {
    case APP_STATES.MAIN_MENU:
      return (
        <div className="app">
          <MainMenu
            onLocalGame={goToLocalSetup}
            onOnlineGame={goToOnlineLobby}
            onShowRules={() => setShowRules(true)}
          />
          <RulesModal 
            isOpen={showRules} 
            onClose={() => setShowRules(false)} 
          />
        </div>
      );

    case APP_STATES.LOCAL_SETUP:
      return (
        <div className="app">
          <div className="header">
            <h1>31 - Local Game</h1>
          </div>
          <GameSetup 
            onCreateGame={createLocalGame} 
            error={error} 
            onBack={goToMainMenu}
          />
          <RulesModal 
            isOpen={showRules} 
            onClose={() => setShowRules(false)} 
          />
        </div>
      );

    case APP_STATES.LOCAL_GAME:
      return (
        <DndProvider backend={HTML5Backend}>
          <div className="app">
            <div className="header">
              <h1>31</h1>
              <div className="game-info">
                <span>Round: {gameState.round_number}</span>
                <span>Phase: {gameState.phase}</span>
                {gameState.winner_id && (
                  <span className="winner">
                    Winner: {gameState.players[gameState.winner_id]?.name}
                  </span>
                )}
              </div>
              <div className="header-controls">
                <div className="header-buttons">
                  <button 
                    onClick={() => setShowRules(true)} 
                    className="btn btn-secondary btn-small"
                    title="View game rules"
                  >
                    📖 Rules
                  </button>
                  <button onClick={goToMainMenu} className="btn btn-secondary">
                    Main Menu
                  </button>
                </div>
              </div>
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
              onRefresh={refreshLocalGameState}
              onNewGame={goToLocalSetup}
              onMainMenu={goToMainMenu}
              canDrawCard={canDrawCard()}
              canDiscardCard={canDiscardCard()}
              canKnock={canKnock()}
            />
            
            <RulesModal 
              isOpen={showRules} 
              onClose={() => setShowRules(false)} 
            />
          </div>
        </DndProvider>
      );

    case APP_STATES.ONLINE_LOBBY:
      return (
        <div className="app">
          <TableLobby
            playerId={playerId}
            playerName={playerName}
            onGameStart={handleTableGameStart}
            onBackToMenu={goToMainMenu}
          />
          <RulesModal 
            isOpen={showRules} 
            onClose={() => setShowRules(false)} 
          />
        </div>
      );

    case APP_STATES.ONLINE_GAME:
      return (
        <DndProvider backend={HTML5Backend}>
          <div className="app">
            <TableGameBoard
              tableId={currentTableId}
              playerId={playerId}
              playerName={playerName}
              onBackToLobby={() => setAppState(APP_STATES.ONLINE_LOBBY)}
              onGameEnd={handleGameEnd}
            />
            <RulesModal 
              isOpen={showRules} 
              onClose={() => setShowRules(false)} 
            />
          </div>
        </DndProvider>
      );

    default:
      return (
        <div className="app">
          <div className="error">Unknown app state</div>
        </div>
      );
  }
}

export default App;
