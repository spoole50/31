import React from 'react';
import Card from './Card';

function PlayerHand({ 
  player, 
  isCurrentPlayer, 
  isActivePlayer, 
  canInteract, 
  onDiscardCard 
}) {
  const getPlayerStatusClass = () => {
    if (player.is_eliminated) return 'eliminated';
    if (isActivePlayer) return 'active-player';
    if (isCurrentPlayer) return 'current-player';
    return '';
  };

  const getLifeIndicators = () => {
    const indicators = [];
    for (let i = 0; i < 3; i++) {
      indicators.push(
        <span 
          key={i} 
          className={`life-indicator ${i < player.lives ? 'alive' : 'lost'}`}
        >
          ♥
        </span>
      );
    }
    return indicators;
  };

  return (
    <div className={`player-hand ${getPlayerStatusClass()}`}>
      <div className="player-info">
        <div className="player-header">
          <h3 className="player-name">
            {player.name}
            {player.is_ai && <span className="ai-badge">AI</span>}
            {isCurrentPlayer && <span className="you-badge">YOU</span>}
          </h3>
          <div className="player-stats">
            <div className="score">
              Score: <strong>{player.score}</strong>
              {player.score === 31 && <span className="perfect-score">★</span>}
            </div>
            <div className="lives">
              Lives: {getLifeIndicators()}
            </div>
          </div>
        </div>
        
        {player.has_knocked && (
          <div className="knocked-indicator">
            🔔 KNOCKED
          </div>
        )}
        
        {player.is_eliminated && (
          <div className="eliminated-indicator">
            ❌ ELIMINATED
          </div>
        )}
      </div>

      <div className="cards-container">
        {/* Show cards for current player, hide for others unless eliminated or game over */}
        {(isCurrentPlayer || player.is_eliminated) ? (
          <div className="cards">
            {player.hand.map((card, index) => (
              <Card
                key={`${card.suit}-${card.value}-${index}`}
                suit={card.suit}
                value={card.value}
                handIndex={index}
                canDrag={canInteract && player.hand.length === 4}
                onDiscard={canInteract ? () => onDiscardCard(index) : null}
                isDiscardable={canInteract && player.hand.length === 4}
              />
            ))}
          </div>
        ) : (
          <div className="cards cards-hidden">
            {player.hand.map((_, index) => (
              <div key={index} className="card card-back">
                <div className="card-back-design">🂠</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {player.hand.length === 4 && isCurrentPlayer && (
        <div className="discard-instruction">
          Click a card or drag it to the discard pile
        </div>
      )}
    </div>
  );
}

export default PlayerHand;
