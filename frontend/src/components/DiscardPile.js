import React from 'react';
import Card from './Card';

function DiscardPile({ 
  cards, 
  canDrop, 
  dropRef, 
  isOver, 
  onDrawFromDiscard, 
  canDrawFromDiscard 
}) {
  const topCard = cards.length > 0 ? cards[0] : null;

  return (
    <div className="discard-pile-section">
      <div 
        ref={dropRef}
        className={`discard-pile ${isOver ? 'drop-over' : ''} ${canDrop ? 'can-drop' : ''}`}
      >
        <h3>Discard Pile</h3>
        {topCard ? (
          <div className="discard-card-container">
            <Card 
              suit={topCard.suit} 
              value={topCard.value} 
              canDrag={false}
            />
            {canDrawFromDiscard && (
              <button 
                onClick={onDrawFromDiscard}
                className="btn btn-small draw-from-discard"
                title="Draw from discard pile"
              >
                Draw
              </button>
            )}
          </div>
        ) : (
          <div className="empty-discard">
            <div className="empty-pile-placeholder">
              Empty Pile
            </div>
          </div>
        )}
        
        {cards.length > 1 && (
          <div className="pile-count">
            {cards.length} cards
          </div>
        )}
        
        {canDrop && (
          <div className="drop-zone-indicator">
            Drop card here to discard
          </div>
        )}
      </div>
    </div>
  );
}

export default DiscardPile;
