import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Users, Edit3, MessageCircle, Heart, ArrowRight, Grid } from 'lucide-react';

export function Home() {
  return (
    <div style={{ width: '100%', maxWidth: '960px', margin: '0 auto', textAlign: 'center' }}>
      {/* Top Brand Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          backgroundColor: 'var(--accent-terracotta-subtle)',
          color: 'var(--accent-terracotta)',
          padding: '0.4rem 1.15rem',
          borderRadius: 'var(--radius-pill)',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1rem'
        }}
      >
        <Sparkles size={16} />
        <span>Instant Multiplayer Hub</span>
      </div>

      <h1
        style={{
          fontSize: '2.75rem',
          fontWeight: 800,
          color: 'var(--text-main)',
          marginBottom: '0.6rem',
          lineHeight: 1.15,
          letterSpacing: '-0.03em'
        }}
      >
        Choose Your Game
      </h1>

      <p
        style={{
          fontSize: '1.1rem',
          color: 'var(--text-muted)',
          lineHeight: 1.5,
          marginBottom: '2.5rem',
          maxWidth: '480px',
          margin: '0 auto 2.5rem'
        }}
      >
        Start a private room in seconds. Play together on phone or PC with zero login.
      </p>

      {/* Two Game Mode Cards Grid */}
      <div className="hub-games-grid">
        {/* Game 1: Comfort Cards */}
        <div className="hub-game-card">
          <div className="hub-card-header">
            <div className="hub-game-icon cards">
              <MessageCircle size={28} color="#D96B43" />
            </div>
            <span className="hub-tag">Reflection</span>
          </div>

          <h3 className="hub-game-title">Comfort Cards</h3>
          <p className="hub-game-desc">
            A warm 120-question conversation deck in Tagalog and English. Connect, listen, and share heartfelt thoughts.
          </p>

          <Link
            to="/create?mode=cards"
            className="btn btn-primary btn-block"
            style={{ padding: '0.85rem', fontSize: '0.95rem', marginTop: 'auto' }}
          >
            <span>Host Comfort Cards</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Game 2: Draw & Guess */}
        <div className="hub-game-card highlight">
          <div className="hub-card-header">
            <div className="hub-game-icon draw">
              <Edit3 size={28} color="#2A9D8F" />
            </div>
            <span className="hub-tag new">New Game!</span>
          </div>

          <h3 className="hub-game-title">Draw & Guess</h3>
          <p className="hub-game-desc">
            Pictionary-style fun! Take turns drawing on your screen while others guess the English word against the clock.
          </p>

          <Link
            to="/create?mode=draw"
            className="btn btn-primary btn-block"
            style={{
              padding: '0.85rem',
              fontSize: '0.95rem',
              marginTop: 'auto',
              backgroundColor: '#2A9D8F',
              borderColor: '#2A9D8F'
            }}
          >
            <span>Host Draw & Guess</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Game 3: Tic-Tac-Toe */}
        <div className="hub-game-card">
          <div className="hub-card-header">
            <div className="hub-game-icon tictac">
              <Grid size={28} color="#E76F51" />
            </div>
            <span className="hub-tag">1v1 / vs AI</span>
          </div>

          <h3 className="hub-game-title">Tic-Tac-Toe</h3>
          <p className="hub-game-desc">
            Quick 3x3 strategy! Play with a friend or test your wits against the smart unbeatable AI.
          </p>

          <Link
            to="/tictactoe"
            className="btn btn-primary btn-block"
            style={{
              padding: '0.85rem',
              fontSize: '0.95rem',
              marginTop: 'auto',
              backgroundColor: '#E76F51',
              borderColor: '#E76F51'
            }}
          >
            <span>Play Tic-Tac-Toe</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Join Any Game Button */}
      <div style={{ marginTop: '2.25rem' }}>
        <Link
          to="/join"
          className="btn btn-secondary"
          style={{
            fontSize: '1.05rem',
            padding: '0.9rem 2.5rem',
            borderRadius: 'var(--radius-pill)',
            border: '1.5px solid var(--accent-border)'
          }}
        >
          <Users size={18} />
          <span>Have a Room Code? Join Game</span>
        </Link>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--accent-border)',
          marginTop: '2.5rem',
          paddingTop: '1.5rem',
          fontSize: '0.85rem',
          color: 'var(--text-light)',
          lineHeight: 1.6
        }}
      >
        <p>Zero signups • Ephemeral P2P sessions • Built for friends & family</p>
      </div>
    </div>
  );
}
