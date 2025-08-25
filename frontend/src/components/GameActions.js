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
      <h3>Actions</h3>
      
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
            isTimedOut ? 'Turn timed out - action disabled' : 
            effectiveCanKnock ? 'Knock to start final round' : 'Cannot knock now'
          }
        >
          🔔 Knock
        </button>
      </div>

      <div className="action-status">
        {isTimedOut && (
          <div className="timeout-message">
            ⏰ Your turn has timed out! Waiting for server to process...
          </div>
        )}
        
        {!isCurrentPlayerTurn && currentTurnPlayer && (
          <div className="waiting-message">
            {currentTurnPlayer.is_ai ? (
              <div>
                🤖 <strong>{currentTurnPlayer.name}</strong> (AI) is thinking...
              </div>
            ) : (
              <div>
                👤 <strong>{currentTurnPlayer.name}</strong>'s turn
              </div>
            )}
          </div>
        )}
        
        {isCurrentPlayerTurn && !isTimedOut && canDrawCard && (
          <div className="instruction">
            🎯 Your turn: Draw a card
          </div>
        )}
        
        {isCurrentPlayerTurn && !isTimedOut && canDiscardCard && (
          <div className="instruction">
            🎯 Your turn: Discard a card
          </div>
        )}
        
        {gamePhase === 'final_round' && (
          <div className="final-round-warning">
            ⚠️ Final Round - Everyone gets one more turn!
          </div>
        )}
      </div>
    </div>
  );
}

export default GameActions;
