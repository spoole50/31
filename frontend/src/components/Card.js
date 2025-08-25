import React from 'react';

function Card({ suit, value, handIndex, onDiscard, isDiscardable = false }) {
  const cardSuit = suit ? suit.toLowerCase() : 'unknown';
  const cardValue = value ? value.toLowerCase() : 'unknown';

  // Ensure correct filenames for face cards
  const faceCardMap = {
    j: 'jack',
    q: 'queen',
    k: 'king',
    a: 'ace',
  };
  const normalizedValue = faceCardMap[cardValue] || cardValue;
  const cardImage = `/PNG-cards-1.3/${normalizedValue}_of_${cardSuit}.png`;

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDiscardable && onDiscard) {
      onDiscard();
    }
  };

  const getCardClass = () => {
    let className = 'game-card';
    if (isDiscardable) className += ' discardable';
    return className;
  };

  return (
    <div 
      className={getCardClass()} 
      style={{
        cursor: isDiscardable ? 'pointer' : 'default',
      }}
      onClick={handleClick}
      title={isDiscardable ? 'Click to discard' : ''}
    >
      <img 
        src={cardImage} 
        alt={`${value || 'Unknown'} of ${suit || 'Unknown'}`} 
        className="card-image" 
        draggable={false}
      />
      {isDiscardable && (
        <div className="discard-overlay">
          <span className="discard-text-desktop">Click to discard</span>
          <span className="discard-text-mobile">Tap to discard</span>
        </div>
      )}
    </div>
  );
}

export default Card;
