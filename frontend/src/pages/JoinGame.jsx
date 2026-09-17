import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';

export function JoinGame({ onJoinRoom }) {
  const { initialCode } = useParams();
  const [roomCode, setRoomCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialCode) {
      setRoomCode(initialCode.toUpperCase());
    }
  }, [initialCode]);

  const handleCodeChange = (e) => {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRoomCode(raw.slice(0, 6));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter a valid 6-character room code.');
      return;
    }

    if (!cleanName) {
      setError('Please enter your name.');
      return;
    }

    if (cleanName.length > 25) {
      setError('Name must be 25 characters or fewer.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      await onJoinRoom(cleanCode, cleanName);
      navigate(`/room/${cleanCode}`);
    } catch (err) {
      setError(err.message || 'Failed to join room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
        <Link
          to="/"
          className="btn-subtle"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0' }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>
      </div>

      <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Join a Game</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem' }}>
        Enter the room code shared by your friend.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="room-code-input" className="input-label">
            Room Code
          </label>
          <input
            id="room-code-input"
            type="text"
            className="input-field input-code"
            placeholder="A7K92P"
            value={roomCode}
            onChange={handleCodeChange}
            maxLength={6}
            autoFocus={!initialCode}
            disabled={loading}
          />
        </div>

        <div className="input-group">
          <label htmlFor="player-name-input" className="input-label">
            Your name
          </label>
          <input
            id="player-name-input"
            type="text"
            className="input-field"
            placeholder="e.g. Maria"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            maxLength={25}
            autoFocus={!!initialCode}
            disabled={loading}
          />
        </div>

        {error && (
          <div style={{ color: '#C84B31', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'left' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || roomCode.length !== 6 || !name.trim()}
          className="btn btn-primary btn-block"
          style={{ marginTop: '1.5rem', padding: '0.95rem' }}
        >
          <LogIn size={18} />
          <span>{loading ? 'Joining Room...' : 'JOIN GAME'}</span>
        </button>
      </form>
    </div>
  );
}
