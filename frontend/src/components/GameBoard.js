import React from 'react';
import { useDrop } from 'react-dnd';
import PlayerHand from './PlayerHand';
import DiscardPile from './DiscardPile';
import GameActions from './GameActions';
import GameLog from './GameLog';

function GameBoard({ 
  gameState, 
  currentPlayerId, 
  onDrawCard, 
  onDiscardCard, 
  onKnock, 
  onRefresh,
  onNewGame,
  onMainMenu,
  turnTimeRemaining
}) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'CARD',
    drop: (item) => {
      // Handle card drop to discard pile
      onDiscardCard(item.handIndex);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const isCurrentPlayerTurn = gameState.current_player_id === currentPlayerId;
  const currentPlayer = gameState.players[currentPlayerId];
  const canDrawCard = currentPlayer && currentPlayer.hand.length === 3 && isCurrentPlayerTurn;
  const canDiscardCard = currentPlayer && currentPlayer.hand.length === 4 && isCurrentPlayerTurn;
  const canKnock = currentPlayer && currentPlayer.hand.length === 3 && isCurrentPlayerTurn && !currentPlayer.has_knocked;

  // Separate current player from others
  const currentPlayerEntry = Object.entries(gameState.players).find(([id]) => id === currentPlayerId);
  const otherPlayers = Object.entries(gameState.players).filter(([id]) => id !== currentPlayerId);

  return (
    <div className="game-board">
      <div className="game-status">
        <div className="current-turn">
          <strong>Current Turn: </strong>
          {gameState.players[gameState.current_player_id]?.name || 'Unknown'}
          {gameState.phase === 'final_round' && (
            <span className="final-round"> (Final Round)</span>
          )}
        </div>
        
        {/* Other Players - Condensed single line */}
        {otherPlayers.length > 0 && (
          <div className="other-players-summary">
            <strong>Other Players: </strong>
            {otherPlayers.map(([playerId, player], index) => (
              <span key={playerId} className="player-summary">
                {player.name}
                <span className="lives-indicator">
                  {Array.from({ length: player.lives }, (_, i) => (
                    <span key={i} className="life-heart">♥</span>
                  ))}
                  {Array.from({ length: 3 - player.lives }, (_, i) => (
                    <span key={i} className="life-heart lost">♡</span>
                  ))}
                </span>
                {index < otherPlayers.length - 1 && ' • '}
              </span>
            ))}
          </div>
        )}
        
        <div className="deck-info">
          <div className="deck-remaining">
            <strong>Cards in Deck:</strong> {gameState.deck_size}
          </div>
        </div>
      </div>

      {/* Game Messages */}
      {gameState.recent_message && (
        <div className="game-message">
          <div className="message-content">
            {gameState.recent_message}
          </div>
        </div>
      )}

      <div className="players-section">
        {/* Main Game Area - Current Player + Controls */}
        {currentPlayerEntry && (
          <div className="main-game-area">
            <div className="current-player-section">
              <PlayerHand
                key={currentPlayerEntry[0]}
                player={currentPlayerEntry[1]}
                isCurrentPlayer={true}
                isActivePlayer={currentPlayerEntry[0] === gameState.current_player_id}
                canInteract={currentPlayerEntry[0] === currentPlayerId && isCurrentPlayerTurn}
                onDiscardCard={onDiscardCard}
                gamePhase={gameState.phase}
              />
            </div>

            <div className="game-controls-section">
              <DiscardPile
                cards={gameState.discard_pile}
                canDrop={canDiscardCard}
                dropRef={drop}
                isOver={isOver}
                onDrawFromDiscard={() => onDrawCard(true)}
                canDrawFromDiscard={canDrawCard}
              />

              <GameActions
                canDrawCard={canDrawCard}
                canDiscardCard={canDiscardCard}
                canKnock={canKnock}
                onDrawCard={() => onDrawCard(false)}
                onKnock={onKnock}
                gamePhase={gameState.phase}
                isCurrentPlayerTurn={isCurrentPlayerTurn}
                currentTurnPlayer={gameState.players[gameState.current_player_id]}
                gameState={gameState}
                turnTimeRemaining={turnTimeRemaining}
              />

              <GameLog 
                gameLog={gameState.game_log} 
                isVisible={true}
              />
            </div>
          </div>
        )}
      </div>

      {gameState.winner_id && (
        <div className="game-over-overlay">
          <div className="game-over-message">
            <div className="winner-crown">👑</div>
            <h2>🎉 Game Over! 🎉</h2>
            <div className="winner-announcement">
              <strong>{gameState.players[gameState.winner_id]?.name}</strong> wins!
            </div>
            <div className="final-scores">
              <h3>🏆 Final Scores</h3>
              {Object.entries(gameState.players)
                .sort(([,a], [,b]) => b.score - a.score)
                .map(([playerId, player], index) => (
                <div key={playerId} className={`score-line ${index === 0 ? 'winner-score' : ''}`}>
                  <span className="rank-emoji">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📋'}
                  </span>
                  <span className="player-name">{player.name}</span>
                  <span className="player-score">{player.score} points</span>
                  <span className="player-lives">
                    {Array.from({ length: player.lives }, (_, i) => '♥').join('')}
                    {Array.from({ length: 3 - player.lives }, (_, i) => '♡').join('')}
                  </span>
                </div>
              ))}
            </div>
            <div className="game-over-actions">
              {onNewGame && (
                <button onClick={onNewGame} className="btn btn-primary">
                  🎯 New Game
                </button>
              )}
              {onMainMenu && (
                <button onClick={onMainMenu} className="btn btn-secondary">
                  🏠 Main Menu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameBoard;
