import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Users, Edit3, MessageCircle, Clock, Tag } from 'lucide-react';
import { DRAW_CATEGORIES, getCategoryDetails, getCategoriesSummary } from '../data/drawWords.js';
import { isHostUnlocked, HostPasscodeModal } from '../components/PasswordGate.jsx';

export function CreateGame({ onCreateRoom }) {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'draw' ? 'DRAW_AND_GUESS' : 'CARDS';

  const [gameType, setGameType] = useState(initialMode);
  const [name, setName] = useState(() => {
    return sessionStorage.getItem('cc_player_name') || localStorage.getItem('matinik_player_name') || '';
  });
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [deckSize, setDeckSize] = useState(30);
  const [totalRounds, setTotalRounds] = useState(5);
  const [roundDuration, setRoundDuration] = useState(60);
  const [selectedCategories, setSelectedCategories] = useState(['ALL']);
  const categorySummary = getCategoriesSummary(selectedCategories);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const navigate = useNavigate();

  const handleToggleCategory = (catId) => {
    if (catId === 'ALL') {
      setSelectedCategories(['ALL']);
      return;
    }
    if (selectedCategories.includes('ALL')) {
      setSelectedCategories([catId]);
    } else if (selectedCategories.includes(catId)) {
      const next = selectedCategories.filter((c) => c !== catId);
      setSelectedCategories(next.length > 0 ? next : ['ALL']);
    } else {
      setSelectedCategories([...selectedCategories, catId]);
    }
  };

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'draw') setGameType('DRAW_AND_GUESS');
    else if (mode === 'cards') setGameType('CARDS');
  }, [searchParams]);

  const playerOptions = [2, 3, 4, 5, 6, 7, 8];

  const deckOptions = [
    { size: 15, label: '15 Cards', desc: 'Quick (~15m)' },
    { size: 30, label: '30 Cards', desc: 'Standard (~35m)' },
    { size: 60, label: '60 Cards', desc: 'Deep Dive (~1h)' }
  ];

  const roundOptions = [
    { rounds: 3, label: '3 Rounds', desc: 'Quick Game' },
    { rounds: 5, label: '5 Rounds', desc: 'Standard' },
    { rounds: 8, label: '8 Rounds', desc: 'Extended' },
    { rounds: 10, label: '10 Rounds', desc: 'Marathon' }
  ];

  const durationOptions = [
    { sec: 45, label: '45s', desc: 'Fast' },
    { sec: 60, label: '60s', desc: 'Normal' },
    { sec: 80, label: '80s', desc: 'Relaxed' }
  ];

  const executeCreateRoom = async (overrideName) => {
    const trimmed = (overrideName !== undefined ? overrideName : name).trim() || 'Ace';
    try {
      setLoading(true);
      setError('');
      // Clean selected categories
      const cleanCategory =
        !selectedCategories || selectedCategories.length === 0 || (selectedCategories.length === 1 && selectedCategories[0] === 'ALL')
          ? 'ALL'
          : selectedCategories;

      const res = await onCreateRoom({
        name: trimmed,
        maxPlayers,
        gameType,
        deckSize,
        totalRounds,
        roundDuration,
        selectedCategory: cleanCategory
      });
      navigate(`/room/${res.roomCode}`);
    } catch (err) {
      console.error('Room creation error:', err);
      setError(err.message || 'Failed to create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmed = name.trim() || 'Ace';

    if (trimmed.length > 25) {
      setError('Nickname must be 25 characters or fewer.');
      return;
    }

    // Host passcode required before creating a room (temporary session)
    if (!isHostUnlocked()) {
      setShowPassModal(true);
      return;
    }

    await executeCreateRoom(trimmed);
  };

  const isDraw = gameType === 'DRAW_AND_GUESS';

  return (
    <div className="panel" style={{ maxWidth: '520px' }}>
      <div style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
        <Link
          to="/"
          className="btn-subtle"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0', fontSize: '0.88rem' }}
        >
          <ArrowLeft size={16} />
          <span>Change Game (Back to Hub)</span>
        </Link>
      </div>

      {/* Selected Game Banner */}
      <div className={`selected-game-banner ${isDraw ? 'draw' : 'cards'}`}>
        <div className={`selected-game-icon ${isDraw ? 'draw' : 'cards'}`}>
          {isDraw ? <Edit3 size={22} color="#2A9D8F" /> : <MessageCircle size={22} color="#D96B43" />}
        </div>
        <div className="selected-game-text">
          <div className="selected-game-name">{isDraw ? 'Draw mo Ayusin mo' : 'Comfort ni Les'}</div>
          <div className="selected-game-tagline">
            {isDraw ? 'Multiplayer sketching & fast guessing' : '120-card heartfelt conversation game'}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ marginTop: '0.5rem' }}>
        <div className="input-group">
          <label htmlFor="host-name" className="input-label">
            Your Nickname
          </label>
          <input
            id="host-name"
            type="text"
            className="input-field"
            placeholder="Ace"
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
        </div>

        {/* Comfort Cards Options */}
        {gameType === 'CARDS' && (
          <div className="input-group" style={{ marginTop: '1.5rem' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={16} />
              <span>Cards in Deck</span>
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
        )}

        {/* Draw & Guess Options */}
        {gameType === 'DRAW_AND_GUESS' && (
          <>
            {/* Rounds Selector */}
            <div className="input-group" style={{ marginTop: '1.5rem' }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Edit3 size={16} />
                <span>Rounds to Play</span>
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}
              >
                {roundOptions.map((opt) => {
                  const isSelected = totalRounds === opt.rounds;
                  return (
                    <button
                      key={opt.rounds}
                      type="button"
                      onClick={() => setTotalRounds(opt.rounds)}
                      disabled={loading}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.65rem 0.2rem',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{opt.label}</span>
                      <span style={{ fontSize: '0.68rem', opacity: isSelected ? 0.9 : 0.7 }}>{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Round Time Selector */}
            <div className="input-group" style={{ marginTop: '1.25rem' }}>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={16} />
                <span>Guess Timer per Turn</span>
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}
              >
                {durationOptions.map((opt) => {
                  const isSelected = roundDuration === opt.sec;
                  return (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => setRoundDuration(opt.sec)}
                      disabled={loading}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.65rem 0.25rem',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{opt.label}</span>
                      <span style={{ fontSize: '0.72rem', opacity: isSelected ? 0.9 : 0.7 }}>{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Word Category Selector (Multi-Select) */}
            <div className="input-group" style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  <Tag size={16} />
                  <span>Word Categories (Multi-Select)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-terracotta)' }}>
                    {categorySummary.isAll ? 'All Categories' : `${categorySummary.categories.length} Selected`}
                  </span>
                  {!categorySummary.isAll && (
                    <button
                      type="button"
                      onClick={() => setSelectedCategories(['ALL'])}
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        textDecoration: 'underline',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Reset to All
                    </button>
                  )}
                </div>
              </div>

              <div className="category-select-grid">
                {DRAW_CATEGORIES.map((cat) => {
                  const isSelected = cat.id === 'ALL'
                    ? selectedCategories.includes('ALL')
                    : !selectedCategories.includes('ALL') && selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleToggleCategory(cat.id)}
                      disabled={loading}
                      className={`category-select-chip ${isSelected ? 'active' : ''}`}
                    >
                      <span className="cat-chip-icon">{cat.icon}</span>
                      <div className="cat-chip-info">
                        <span className="cat-chip-title">{cat.name}</span>
                      </div>
                      {isSelected && <span className="cat-chip-check">✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Detailed preview card for selected categories */}
              <div className="category-detail-preview">
                <div className="cat-preview-header">
                  <span className="cat-preview-icon">{categorySummary.icon}</span>
                  <strong className="cat-preview-name">{categorySummary.title}</strong>
                  <span className="cat-preview-count-pill">{categorySummary.count} words</span>
                </div>
                <p className="cat-preview-desc" style={{ margin: 0 }}>{categorySummary.desc}</p>
              </div>
            </div>
          </>
        )}

        {error && (
          <div style={{ color: '#C84B31', fontSize: '0.85rem', marginTop: '1rem', textAlign: 'left' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary btn-block"
          style={{ marginTop: '2rem', padding: '1rem', fontSize: '1.05rem' }}
        >
          <Sparkles size={18} />
          <span>{loading ? 'Creating Room...' : `CREATE ${gameType === 'DRAW_AND_GUESS' ? 'DRAW & GUESS' : 'COMFORT CARDS'} ROOM`}</span>
        </button>
      </form>

      {/* Host Authorization Passcode Modal */}
      <HostPasscodeModal
        isOpen={showPassModal}
        onClose={() => setShowPassModal(false)}
        onSuccess={() => {
          setShowPassModal(false);
          executeCreateRoom();
        }}
      />
    </div>
  );
}
