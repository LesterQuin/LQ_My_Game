import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Users } from 'lucide-react';

export function CreateGame({ onCreateRoom }) {
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [deckSize, setDeckSize] = useState(30);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const playerOptions = [2, 3, 4, 5, 6, 7, 8];
  const deckOptions = [
    { size: 15, label: '15 Cards', desc: 'Quick (~15m)' },
    { size: 30, label: '30 Cards', desc: 'Standard (~35m)' },
    { size: 60, label: '60 Cards', desc: 'Deep Dive (~1h)' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError('Please enter your nickname.');
      return;
    }

    if (trimmed.length > 25) {
      setError('Nickname must be 25 characters or fewer.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await onCreateRoom({ name: trimmed, maxPlayers, deckSize });
      navigate(`/room/${res.roomCode}`);
    } catch (err) {
      setError(err.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: '480px' }}>
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

      <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Create a Game</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem' }}>
        Start a temporary room and invite friends to talk.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="host-name" className="input-label">
            Nickname
          </label>
          <input
            id="host-name"
            type="text"
            className="input-field"
            placeholder="e.g. Lester"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            maxLength={25}
            autoFocus
            disabled={loading}
          />
        </div>

        {/* Max Players Selector: 2 to 8 */}
        <div className="input-group" style={{ marginTop: '1.5rem' }}>
          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={16} />
            <span>Maximum Players ({maxPlayers})</span>
          </label>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '0.5rem'
            }}
          >
            {playerOptions.map((count) => {
              const isSelected = maxPlayers === count;
              return (
                <button
                  key={count}
                  type="button"
                  onClick={() => setMaxPlayers(count)}
                  disabled={loading}
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    minWidth: '42px',
                    height: '42px',
                    padding: '0',
                    fontSize: '0.95rem',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  {count}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.5rem', textAlign: 'center' }}>
            Choose between 2 to 8 players.
          </div>
        </div>

        {/* Deck Length Selector: 15, 30, 60 */}
        <div className="input-group" style={{ marginTop: '1.5rem' }}>
          <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={16} />
            <span>Deck Length ({deckSize} Questions)</span>
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.6rem',
              marginTop: '0.5rem'
            }}
          >
            {deckOptions.map((opt) => {
              const isSelected = deckSize === opt.size;
              return (
                <button
                  key={opt.size}
                  type="button"
                  onClick={() => setDeckSize(opt.size)}
                  disabled={loading}
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.75rem 0.25rem',
                    borderRadius: 'var(--radius-md)',
                    gap: '0.2rem'
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{opt.label}</span>
                  <span style={{ fontSize: '0.72rem', opacity: isSelected ? 0.9 : 0.7 }}>{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div style={{ color: '#C84B31', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'left' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="btn btn-primary btn-block"
          style={{ marginTop: '2rem', padding: '0.95rem' }}
        >
          <Sparkles size={18} />
          <span>{loading ? 'Creating Room...' : 'CREATE ROOM'}</span>
        </button>
      </form>
    </div>
  );
}
