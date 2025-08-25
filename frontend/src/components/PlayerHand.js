import React from 'react';
import Card from './Card';

function PlayerHand({ 
  player, 
  isCurrentPlayer, 
  isActivePlayer, 
  canInteract, 
  onDiscardCard,
  gamePhase 
}) {
  const getPlayerStatusClass = () => {
    if (player.is_eliminated) return 'eliminated';
    if (isCurrentPlayer) return 'current-player';
    if (isActivePlayer) return 'active-player';
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
            {/* Only show score to current player, or if game is finished/player eliminated */}
            {(isCurrentPlayer || player.is_eliminated || gamePhase === 'finished') ? (
              <div className="score">
                Score: <strong>{player.score}</strong>
                {player.score === 31 && <span className="perfect-score">★</span>}
              </div>
            ) : (
              <div className="score-hidden">
                Score: <strong>???</strong>
              </div>
            )}
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
        {/* Show cards for current player, or when game is finished, or if player is eliminated */}
        {(isCurrentPlayer || player.is_eliminated || gamePhase === 'finished') ? (
          <div className={`cards ${player.hand.length === 4 ? 'four-cards' : ''}`}>
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
          <div className={`cards cards-hidden ${player.hand.length === 4 ? 'four-cards' : ''}`}>
            {player.hand.map((_, index) => (
              <div key={index} className="game-card card-back">
                <div className="card-back-design">🂠</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {player.hand.length === 4 && isCurrentPlayer && (
        <div className="discard-instruction">
          <span className="instruction-desktop">Click a card or drag it to the discard pile</span>
          <span className="instruction-mobile">Tap or drag a card to discard</span>
        </div>
      )}
    </div>
  );
}

export default PlayerHand;
