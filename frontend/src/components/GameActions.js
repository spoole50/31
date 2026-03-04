import React from 'react';

function GameActions({ 
  canDrawCard, 
  canDiscardCard, 
  canKnock, 
  onDrawCard, 
  onKnock, 
  gamePhase, 
  isCurrentPlayerTurn,
  currentTurnPlayer,
  gameState,
  turnTimeRemaining = 45
}) {
  // Disable actions if turn time has expired (for current player only)
  const isTimedOut = isCurrentPlayerTurn && turnTimeRemaining <= 0;
  const effectiveCanDrawCard = canDrawCard && !isTimedOut;
  const effectiveCanKnock = canKnock && !isTimedOut;
  return (
    <div className="game-actions">
      <div className="action-buttons">
        <button 
          onClick={onDrawCard}
          disabled={!effectiveCanDrawCard}
          className={`btn ${effectiveCanDrawCard ? 'btn-primary' : 'btn-disabled'}`}
          title={
            isTimedOut ? 'Turn timed out - action disabled' : 
            effectiveCanDrawCard ? 'Draw a card from the deck' : 'Cannot draw card now'
          }
        >
          Draw from Deck
        </button>

        <button 
          onClick={onKnock}
          disabled={!effectiveCanKnock}
          className={`btn ${effectiveCanKnock ? 'btn-warning' : 'btn-disabled'}`}
          title={
            isTimedOut ? 'Turn timed out' : 
            effectiveCanKnock ? 'Knock to start final round' : 'Cannot knock now'
          }
        >
          Knock
        </button>
      </div>

      <div className="action-status">
        {isTimedOut && (
          <div className="timeout-message">
            Turn timed out — waiting for server...
          </div>
        )}
        
        {!isCurrentPlayerTurn && currentTurnPlayer && (
          <div className="waiting-message">
            {currentTurnPlayer.is_ai ? (
              <span><strong>{currentTurnPlayer.name}</strong> is thinking...</span>
            ) : (
              <span><strong>{currentTurnPlayer.name}</strong>'s turn</span>
            )}
          </div>
        )}
        
        {isCurrentPlayerTurn && !isTimedOut && canDrawCard && (
          <div className="instruction">
            Draw a card to continue
          </div>
        )}
        
        {isCurrentPlayerTurn && !isTimedOut && canDiscardCard && (
          <div className="instruction">
            Choose a card to discard
          </div>
        )}
        
        {gamePhase === 'final_round' && (
          <div className="final-round-warning">
            Final Round — one more turn each
          </div>
        )}
      </div>
    </div>
  );
}

export default GameActions;
