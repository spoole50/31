import React, { useState } from 'react';

function RulesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎴 Game Rules - 31</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="rules-section">
            <h3>🎯 Objective</h3>
            <p>Get as close to 31 points as possible using cards of the same suit.</p>
          </div>

          <div className="rules-section">
            <h3>🔢 Card Values</h3>
            <ul>
              <li><strong>Ace:</strong> 11 points</li>
              <li><strong>King, Queen, Jack:</strong> 10 points each</li>
              <li><strong>Number cards (2-10):</strong> Face value</li>
              <li><strong>Three of a kind:</strong> 30 points (any suit)</li>
            </ul>
          </div>

          <div className="rules-section">
            <h3>🎮 How to Play</h3>
            <ol>
              <li><strong>Starting:</strong> Each player gets 3 cards and 3 lives</li>
              <li><strong>Your Turn:</strong>
                <ul>
                  <li>Draw from the deck OR draw from discard pile</li>
                  <li>Discard one card (click to discard)</li>
                </ul>
              </li>
              <li><strong>Knocking:</strong> Click "Knock" to signal the final round</li>
              <li><strong>Scoring:</strong> Best suit combination wins the round</li>
              <li><strong>Lives:</strong> Lowest scorer loses a life each round</li>
            </ol>
          </div>

          <div className="rules-section">
            <h3>🏆 Winning Examples</h3>
            <div className="examples">
              <div className="example">
                <strong>Perfect 31:</strong> Ace + King + Queen (same suit) = 31 points
              </div>
              <div className="example">
                <strong>Three of a Kind:</strong> Any three cards of same value = 30 points
              </div>
              <div className="example">
                <strong>Good Hand:</strong> Ace + 10 + 9 (same suit) = 30 points
              </div>
            </div>
          </div>

          <div className="rules-section">
            <h3>💡 Strategy Tips</h3>
            <ul>
              <li>Focus on one suit for the highest score</li>
              <li>Watch what opponents discard</li>
              <li>Knock when you have 25+ points</li>
              <li>Three of a kind is almost always a good knock</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Got it! Let's Play 🎮
          </button>
        </div>
      </div>
    </div>
  );
}

export default RulesModal;
