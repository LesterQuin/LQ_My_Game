import React from 'react';
import { Sparkles } from 'lucide-react';

export function Card({
  isRevealed,
  question,
  isMyTurn,
  currentPlayerName,
  onDraw,
  disabled
}) {
  return (
    <div className="card-wrapper">
      <div className={`card-inner ${isRevealed ? 'flipped' : ''}`}>
        {/* Back Face (Unrevealed Card) */}
        <div className="card-face card-back">
          <div className="card-back-title">Comfort Card</div>

          <div className="card-back-prompt">Ready?</div>

          {isMyTurn ? (
            <button
              onClick={onDraw}
              disabled={disabled}
              className="btn btn-primary"
              style={{
                fontSize: '1.05rem',
                padding: '0.9rem 2rem',
                backgroundColor: '#D96B43',
                color: '#FFFFFF'
              }}
            >
              <Sparkles size={18} />
              <span>DRAW CARD</span>
            </button>
          ) : (
            <div
              style={{
                fontSize: '0.95rem',
                color: 'rgba(255, 255, 255, 0.7)',
                marginTop: '0.5rem'
              }}
            >
              Waiting for {currentPlayerName || 'player'} to draw...
            </div>
          )}
        </div>

        {/* Front Face (Revealed Question) */}
        <div className="card-face card-front">
          <div className="card-front-tag">Comfort Card</div>
          <div className="card-question">
            "{question || 'Drawing card...'}"
          </div>
        </div>
      </div>
    </div>
  );
}
