import React from 'react';
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
  turnTimeRemaining,
  hideGameOverOverlay = false
}) {

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
      {/* Compact Game Status Header */}
      <div className="game-status">
        <div className="status-compact">
          <div className="turn-info">
            <span className="current-turn">
              {gameState.players[gameState.current_player_id]?.name || 'Unknown'}'s Turn
            </span>
            {gameState.phase === 'final_round' && (
              <span className="final-round-badge">Final Round</span>
            )}
          </div>
          
          <div className="game-meta">
            <span className="round-info">Round {gameState.round_number}</span>
            <span className="phase-info">{gameState.phase.replace('_', ' ')}</span>
            <span className="deck-count">Deck: {gameState.deck_size}</span>
          </div>
          
          {otherPlayers.length > 0 && (
            <div className="other-players-compact">
              {otherPlayers.map(([playerId, player], index) => (
                <span key={playerId} className="player-quick">
                  {player.name}
                  <span className="lives-quick">
                    {Array.from({ length: player.lives }, (_, i) => '♥').join('')}
                  </span>
                  {index < otherPlayers.length - 1 && ' • '}
                </span>
              ))}
            </div>
          )}
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

      {/* Main Game Layout - Optimized Order */}
      <div className="game-table">
        {/* Player Cards and Discard Row */}
        <div className="player-discard-row">
          {/* Current Player Area */}
          {currentPlayerEntry && (
            <div className="current-player-area">
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
          )}
          
          {/* Discard Pile */}
          <div className="discard-section">
            <DiscardPile
              cards={gameState.discard_pile}
              onDrawFromDiscard={() => onDrawCard(true)}
              canDrawFromDiscard={canDrawCard}
            />
          </div>
        </div>
        
        {/* Actions and Log Row */}
        <div className="actions-log-row">
          {/* Game Actions */}
          <div className="actions-section">
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
          </div>
          
          {/* Game Log - Desktop */}
          <div className="desktop-log">
            <GameLog 
              gameLog={gameState.game_log} 
              isVisible={true}
            />
          </div>
        </div>
        
        {/* Mobile Game Log */}
        <div className="mobile-game-log">
          <GameLog 
            gameLog={gameState.game_log} 
            isVisible={true}
          />
        </div>
      </div>

      {/* Game Over Overlay - only show if not hidden */}
      {gameState.winner_id && !hideGameOverOverlay && (
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
