import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, LogOut } from 'lucide-react';
import { clearSessionRoom, getSessionData } from '../utils/session.js';

export function Header({ roomCode, onLeave }) {
  const navigate = useNavigate();
  const { playerId } = getSessionData();

  const handleLeave = () => {
    if (onLeave) {
      onLeave();
    } else {
      clearSessionRoom();
      navigate('/');
    }
  };

  return (
    <header className="app-header">
      <Link to="/" className="app-brand">
        <Heart size={20} color="#D96B43" fill="#D96B43" />
        <span>Comfort Cards</span>
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
