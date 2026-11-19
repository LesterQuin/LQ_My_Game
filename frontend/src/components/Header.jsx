import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Heart, LogOut, Edit3, Grid, Sparkles } from 'lucide-react';
import { clearSessionRoom, getSessionData } from '../utils/session.js';

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

  const isTicTac = location.pathname.includes('/tictactoe');
  const isDraw = gameType === 'DRAW_AND_GUESS' || location.search.includes('mode=draw');

  return (
    <header className="app-header">
      <Link to="/" className="app-brand">
        {isTicTac ? (
          <>
            <Grid size={20} color="#2A9D8F" />
            <span>Tic-Tac-Toe</span>
          </>
        ) : isDraw ? (
          <>
            <Edit3 size={20} color="#2A9D8F" />
            <span>Draw & Guess</span>
          </>
        ) : (
          <>
            <Heart size={20} color="#D96B43" fill="#D96B43" />
            <span>Comfort Cards</span>
          </>
        )}
      </Link>

      {roomCode && (
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
      )}
    </header>
  );
}
