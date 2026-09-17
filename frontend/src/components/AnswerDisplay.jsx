import React from 'react';
import { ArrowRight, Heart } from 'lucide-react';

export function AnswerDisplay({
  answer,
  nextPlayerName,
  canAdvance,
  onNext,
  disabled
}) {
  if (!answer) return null;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '440px',
        margin: '0 auto',
        animation: 'slideUp 0.4s ease-out'
      }}
    >
      <div className="answer-card">
        <div className="answer-author">{answer.playerName}'s Answer</div>
        <div className="answer-body">"{answer.text}"</div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          margin: '1.25rem 0'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--accent-terracotta)',
            fontWeight: 600,
            fontSize: '0.95rem'
          }}
        >
          <span>Answer submitted</span>
          <Heart size={16} fill="var(--accent-terracotta)" />
        </div>

        {nextPlayerName && (
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Next player: <strong>{nextPlayerName}</strong>
          </div>
        )}

        {canAdvance ? (
          <button
            onClick={onNext}
            disabled={disabled}
            className="btn btn-primary"
            style={{ marginTop: '0.5rem', padding: '0.75rem 1.75rem' }}
          >
            <span>Next Card</span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>
            Waiting for {answer.playerName || 'player'} to continue...
          </div>
        )}
      </div>
    </div>
  );
}
