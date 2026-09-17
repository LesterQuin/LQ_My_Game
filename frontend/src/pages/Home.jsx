import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Users, Heart } from 'lucide-react';

export function Home() {
  return (
    <div className="panel" style={{ maxWidth: '520px' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          backgroundColor: 'var(--accent-terracotta-subtle)',
          color: 'var(--accent-terracotta)',
          padding: '0.4rem 1rem',
          borderRadius: 'var(--radius-pill)',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1.5rem'
        }}
      >
        <Sparkles size={16} />
        <span>Tagalog-English Conversation Deck</span>
      </div>

      <h1
        style={{
          fontSize: '2.5rem',
          fontWeight: 700,
          color: 'var(--text-main)',
          marginBottom: '1rem',
          lineHeight: 1.15
        }}
      >
        Comfort Cards
      </h1>

      <p
        style={{
          fontSize: '1.15rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          marginBottom: '2.5rem',
          maxWidth: '420px',
          margin: '0 auto 2.5rem'
        }}
      >
        Sometimes one question is enough to start a meaningful conversation.
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          maxWidth: '320px',
          margin: '0 auto 2rem'
        }}
      >
        <Link to="/create" className="btn btn-primary btn-block" style={{ fontSize: '1.05rem', padding: '1rem' }}>
          <Sparkles size={18} />
          <span>Create a Game</span>
        </Link>

        <Link to="/join" className="btn btn-secondary btn-block" style={{ fontSize: '1.05rem', padding: '1rem' }}>
          <Users size={18} />
          <span>Join a Game</span>
        </Link>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--accent-border)',
          paddingTop: '1.5rem',
          fontSize: '0.875rem',
          color: 'var(--text-light)',
          lineHeight: 1.5
        }}
      >
        <p>No account required.</p>
        <p>Your game is temporary.</p>
      </div>
    </div>
  );
}
