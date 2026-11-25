import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, LogOut, Edit3, Grid, Lock, Sparkles } from 'lucide-react';
import { clearSessionRoom, getSessionData } from '../utils/session.js';
import { isHostUnlocked, lockHost } from './PasswordGate.jsx';

export function Header({ roomCode, gameType, onLeave }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { playerId } = getSessionData();

  const handleLeave = () => {
    if (onLeave) {
      onLeave();
    } else {
      clearSessionRoom();
      navigate('/');
    }
  };

  const handleLockHost = () => {
    lockHost();
    window.location.reload();
  };

  const isTicTac = location.pathname.includes('/tictactoe');
  const isDraw = gameType === 'DRAW_AND_GUESS' || location.search.includes('mode=draw');
  const hostUnlocked = isHostUnlocked();

  return (
    <header className="app-header">
      <Link to="/" className="app-brand">
        {isTicTac ? (
          <>
            <Grid size={20} color="#2A9D8F" />
            <span>Tic-Tok-Too</span>
          </>
        ) : isDraw ? (
          <>
            <Edit3 size={20} color="#2A9D8F" />
            <span>Draw mo Ayusin mo</span>
          </>
        ) : gameType === 'CARDS' || location.search.includes('mode=cards') ? (
          <>
            <Heart size={20} color="#D96B43" fill="#D96B43" />
            <span>Comfort ni Les</span>
          </>
        ) : (
          <>
            <Sparkles size={20} color="#D96B43" />
            <span>Lester's Games</span>
          </>
        )}
      </Link>

      {roomCode ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="room-badge">
            <span>ROOM:</span>
            <span className="room-badge-code">{roomCode}</span>
          </div>

          <button
            onClick={handleLeave}
            className="btn btn-subtle"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem' }}
            title="Leave room"
          >
            <LogOut size={16} />
            <span style={{ fontSize: '0.85rem' }}>Leave</span>
          </button>
        </div>
      ) : hostUnlocked ? (
        <button
          onClick={handleLockHost}
          className="btn btn-subtle"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
          title="Lock Host Privileges (Temporary Session)"
        >
          <Lock size={13} color="var(--accent-terracotta)" />
          <span>Lock Host</span>
        </button>
      ) : null}
    </header>
  );
}
