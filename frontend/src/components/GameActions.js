import React from 'react';

function GameActions({ 
  canDrawCard, 
  canDiscardCard, 
  canKnock, 
  onDrawCard, 
  onKnock, 
  gamePhase, 
  isCurrentPlayerTurn 
}) {
  return (
    <div className="game-actions">
      <h3>Actions</h3>
      
      <div className="action-buttons">
        <button 
          onClick={onDrawCard}
          disabled={!canDrawCard}
          className={`btn ${canDrawCard ? 'btn-primary' : 'btn-disabled'}`}
          title={canDrawCard ? 'Draw a card from the deck' : 'Cannot draw card now'}
        >
          Draw from Deck
        </button>

        <button 
          onClick={onKnock}
          disabled={!canKnock}
          className={`btn ${canKnock ? 'btn-warning' : 'btn-disabled'}`}
          title={canKnock ? 'Knock to start final round' : 'Cannot knock now'}
        >
          Knock
        </button>
      </div>

      <div className="action-status">
        {!isCurrentPlayerTurn && (
          <div className="waiting-message">
            Waiting for other player's turn...
          </div>
        )}
        
        {isCurrentPlayerTurn && canDrawCard && (
          <div className="instruction">
            Your turn: Draw a card
          </div>
        )}
        
        {isCurrentPlayerTurn && canDiscardCard && (
          <div className="instruction">
            Your turn: Discard a card
          </div>
        )}
        
        {gamePhase === 'final_round' && (
          <div className="final-round-warning">
            ⚠️ Final Round - Everyone gets one more turn!
          </div>
        )}
      </div>

      <div className="game-tips">
        <h4>Tips:</h4>
        <ul>
          <li>Goal: Highest total in same suit</li>
          <li>31 points = instant win</li>
          <li>Three Aces = 31 points</li>
          <li>Knock when confident in your hand</li>
        </ul>
      </div>
    </div>
  );
}

export default GameActions;
