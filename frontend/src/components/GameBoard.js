import React from 'react';
import { useDrop } from 'react-dnd';
import PlayerHand from './PlayerHand';
import DiscardPile from './DiscardPile';
import GameActions from './GameActions';

function GameBoard({ 
  gameState, 
  currentPlayerId, 
  onDrawCard, 
  onDiscardCard, 
  onKnock, 
  onRefresh 
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

  // Sort players to show current player first
  const sortedPlayers = Object.entries(gameState.players).sort(([idA], [idB]) => {
    if (idA === currentPlayerId) return -1;
    if (idB === currentPlayerId) return 1;
    return 0;
  });

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
        
        <div className="deck-info">
          <div className="deck-remaining">
            <strong>Cards in Deck:</strong> {gameState.deck_size}
          </div>
          <button onClick={onRefresh} className="btn btn-small">
            Refresh
          </button>
        </div>
      </div>

      <div className="players-section">
        {sortedPlayers.map(([playerId, player]) => (
          <PlayerHand
            key={playerId}
            player={player}
            isCurrentPlayer={playerId === currentPlayerId}
            isActivePlayer={playerId === gameState.current_player_id}
            canInteract={playerId === currentPlayerId && isCurrentPlayerTurn}
            onDiscardCard={onDiscardCard}
          />
        ))}
      </div>

      <div className="game-center">
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
        />
      </div>

      {gameState.winner_id && (
        <div className="game-over-overlay">
          <div className="game-over-message">
            <h2>Game Over!</h2>
            <p>
              <strong>{gameState.players[gameState.winner_id]?.name}</strong> wins!
            </p>
            <div className="final-scores">
              <h3>Final Scores:</h3>
              {Object.entries(gameState.players).map(([playerId, player]) => (
                <div key={playerId} className="score-line">
                  <span className="player-name">{player.name}:</span>
                  <span className="player-score">{player.score} points</span>
                  <span className="player-lives">({player.lives} lives)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameBoard;
