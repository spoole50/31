import React from 'react';
import { useDrag } from 'react-dnd';

function Card({ suit, value, handIndex, canDrag = true, onDiscard, isDiscardable = false }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'CARD',
    item: { suit, value, handIndex },
    canDrag: canDrag,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const style = {
    opacity: isDragging ? 0.5 : 1,
    cursor: canDrag ? 'move' : 'default',
  };

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
  const cardImage = `/card_images/PNG-cards-1.3/${normalizedValue}_of_${cardSuit}.png`;

  const handleClick = () => {
    if (isDiscardable && onDiscard) {
      onDiscard();
    }
  };

  const getCardClass = () => {
    let className = 'card';
    if (isDiscardable) className += ' discardable';
    if (!canDrag) className += ' no-drag';
    return className;
  };

  return (
    <div 
      ref={drag} 
      className={getCardClass()} 
      style={style}
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
          Click to discard
        </div>
      )}
    </div>
  );
}

export default Card;
