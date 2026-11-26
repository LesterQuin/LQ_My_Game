import React, { useState } from 'react';
import { Copy, Check, Play, LogOut, Users, Share2, Crown, QrCode, Sparkles, Edit3, Clock, Tag } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard.js';
import { DRAW_CATEGORIES, getCategoriesSummary } from '../data/drawWords.js';

export function Lobby({
  roomState,
  playerId,
  onStartGame,
  onLeaveRoom,
  onSetDeckSize,
  onSetRounds,
  onSetRoundDuration,
  onSetCategory
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [starting, setStarting] = useState(false);

  if (!roomState) return null;

  const isHost = roomState.hostPlayerId === playerId;
  const hostPlayer = roomState.players.find((p) => p.isHost) || roomState.players[0];
  const inviteUrl = `${window.location.origin}${window.location.pathname}#/join/${roomState.roomCode}`;
  const isDrawGame = roomState.gameType === 'DRAW_AND_GUESS';

  const currentDeckSize = roomState.deckSize || 30;
  const currentRounds = roomState.totalRounds || 5;
  const currentDuration = roomState.roundDuration || 60;
  const currentCategoryRaw = roomState.selectedCategory || 'ALL';
  const currentCategories = Array.isArray(currentCategoryRaw)
    ? currentCategoryRaw
    : (typeof currentCategoryRaw === 'string' && currentCategoryRaw.includes(',')
      ? currentCategoryRaw.split(',').map((s) => s.trim())
      : (currentCategoryRaw !== 'ALL' ? [currentCategoryRaw] : ['ALL']));
  const categorySummary = getCategoriesSummary(currentCategories);

  const handleToggleCategory = (catId) => {
    if (!onSetCategory) return;
    if (catId === 'ALL') {
      onSetCategory('ALL');
      return;
    }
    if (currentCategories.includes('ALL')) {
      onSetCategory([catId]);
    } else if (currentCategories.includes(catId)) {
      const next = currentCategories.filter((c) => c !== catId);
      onSetCategory(next.length > 0 ? next : 'ALL');
    } else {
      onSetCategory([...currentCategories, catId]);
    }
  };

  const deckOptions = [
    { size: 15, label: '15 Cards', desc: 'Quick' },
    { size: 30, label: '30 Cards', desc: 'Standard' },
    { size: 60, label: '60 Cards', desc: 'Deep' }
  ];

  const roundOptions = [
    { rounds: 3, label: '3' },
    { rounds: 5, label: '5' },
    { rounds: 8, label: '8' },
    { rounds: 10, label: '10' }
  ];

  const durationOptions = [
    { sec: 45, label: '45s' },
    { sec: 60, label: '60s' },
    { sec: 80, label: '80s' }
  ];

  const currentCount = roomState.players.length;
  const maxCount = roomState.maxPlayers || 6;
  const emptySlotsCount = Math.max(0, maxCount - currentCount);

  // For draw game, need at least 2 players to start
  const canStart = isHost && (isDrawGame ? currentCount >= 2 : currentCount >= 1);

  const handleCopyCode = async () => {
    const ok = await copyToClipboard(roomState.roomCode);
    if (ok) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(inviteUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleStart = async () => {
    try {
      setStarting(true);
      await onStartGame();
    } catch (err) {
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: '520px' }}>
      {/* Game Mode Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          backgroundColor: isDrawGame ? 'rgba(42, 157, 143, 0.12)' : 'var(--accent-terracotta-subtle)',
          color: isDrawGame ? '#2A9D8F' : 'var(--accent-terracotta)',
          padding: '0.35rem 0.9rem',
          borderRadius: 'var(--radius-pill)',
          fontSize: '0.85rem',
          fontWeight: 700,
          marginBottom: '0.75rem'
        }}
      >
        {isDrawGame ? <Edit3 size={15} /> : <Sparkles size={15} />}
        <span>{isDrawGame ? 'Draw mo Ayusin mo' : 'Comfort ni Les'}</span>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.2rem', letterSpacing: '0.05em' }}>
          ROOM CODE
        </div>
        <div
          style={{
            fontSize: '3rem',
            fontWeight: 800,
            letterSpacing: '0.2em',
            color: 'var(--text-main)',
            lineHeight: 1.2,
            fontFamily: 'monospace'
          }}
        >
          {roomState.roomCode}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          justifyContent: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap'
        }}
      >
        <button
          onClick={handleCopyCode}
          className="btn btn-outline"
          style={{ fontSize: '0.875rem', padding: '0.55rem 1rem' }}
        >
          {copiedCode ? <Check size={16} color="var(--accent-sage)" /> : <Copy size={16} />}
          <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
        </button>

        <button
          onClick={handleCopyLink}
          className="btn btn-secondary"
          style={{ fontSize: '0.875rem', padding: '0.55rem 1rem' }}
        >
          {copiedLink ? <Check size={16} color="var(--accent-sage)" /> : <Share2 size={16} />}
          <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
        </button>

        <button
          onClick={() => setShowQR((prev) => !prev)}
          className={`btn ${showQR ? 'btn-primary' : 'btn-outline'}`}
          style={{ fontSize: '0.875rem', padding: '0.55rem 1rem' }}
        >
          <QrCode size={16} />
          <span>{showQR ? 'Hide QR' : 'Scan QR'}</span>
        </button>
      </div>

      {/* QR Code Scannable Box */}
      {showQR && (
        <div className="qr-card-box">
          <div className="qr-image-wrapper">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}&color=2D2926&bgcolor=FFFDF9&margin=6`}
              alt={`QR code to join room ${roomState.roomCode}`}
            />
          </div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
            Scan with your phone camera
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Join room {roomState.roomCode} instantly
          </div>
        </div>
      )}

      {/* Game Specific Settings Card */}
      {!isDrawGame ? (
        /* Comfort Cards: Deck Length */
        <div
          style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            textAlign: 'left'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: isHost ? '0.6rem' : '0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
              <Sparkles size={15} color="var(--accent-terracotta)" />
              <span>Deck Length</span>
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-terracotta)' }}>
              {currentDeckSize} Questions
            </span>
          </div>

          {isHost ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
              {deckOptions.map((opt) => {
                const isSelected = currentDeckSize === opt.size;
                return (
                  <button
                    key={opt.size}
                    type="button"
                    onClick={() => onSetDeckSize && onSetDeckSize(opt.size)}
                    className={`btn ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                    style={{
                      padding: '0.45rem 0.2rem',
                      fontSize: '0.8rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{opt.label}</span>
                    <span style={{ fontSize: '0.68rem', opacity: isSelected ? 0.9 : 0.7 }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              The host set this game to <strong>{currentDeckSize} questions</strong>.
            </div>
          )}
        </div>
      ) : (
        /* Draw & Guess Settings */
        <div
          style={{
            background: 'var(--bg-canvas)',
            border: '1px solid var(--accent-border)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            textAlign: 'left'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: isHost ? '0.6rem' : '0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
              <Edit3 size={15} color="#2A9D8F" />
              <span>Rounds & Settings</span>
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2A9D8F' }}>
              {currentRounds} Rounds • {currentDuration}s • {categorySummary.icon} {categorySummary.title}
            </span>
          </div>

          {isHost ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {/* Category toggle (Multi-select) */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '55px', paddingTop: '4px' }}>Categories:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', flex: 1 }}>
                  {DRAW_CATEGORIES.map((cat) => {
                    const isSelected = cat.id === 'ALL'
                      ? currentCategories.includes('ALL')
                      : !currentCategories.includes('ALL') && currentCategories.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleToggleCategory(cat.id)}
                        className={`lobby-cat-btn ${isSelected ? 'active' : ''}`}
                        title={`${cat.name}: ${cat.desc}`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                        {isSelected && <span style={{ fontSize: '0.7rem', fontWeight: 800, marginLeft: '2px' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Category Details Banner */}
              <div className="lobby-category-detail-banner">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{categorySummary.icon}</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{categorySummary.title}</strong>
                  </div>
                  <span className="cat-preview-count-pill" style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(42, 157, 143, 0.12)', color: '#2A9D8F', padding: '0.15rem 0.45rem', borderRadius: 'var(--radius-pill)' }}>
                    {categorySummary.count} words
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {categorySummary.desc}
                </div>
              </div>

              {/* Rounds toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '55px' }}>Rounds:</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', flex: 1 }}>
                  {roundOptions.map((opt) => (
                    <button
                      key={opt.rounds}
                      type="button"
                      onClick={() => onSetRounds && onSetRounds(opt.rounds)}
                      className={`btn ${currentRounds === opt.rounds ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '0.35rem 0', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', minWidth: '55px' }}>Timer:</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', flex: 1 }}>
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.sec}
                      type="button"
                      onClick={() => onSetRoundDuration && onSetRoundDuration(opt.sec)}
                      className={`btn ${currentDuration === opt.sec ? 'btn-primary' : 'btn-outline'}`}
                      style={{ padding: '0.35rem 0', fontSize: '0.8rem', borderRadius: 'var(--radius-sm)' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Host configured: <strong>{currentRounds} Rounds</strong> ({currentDuration}s) with <strong>{categorySummary.title}</strong>.
              </div>
              <div className="lobby-category-detail-banner">
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {categorySummary.desc}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Players Slot List */}
      <div
        style={{
          borderTop: '1px solid var(--accent-border)',
          borderBottom: '1px solid var(--accent-border)',
          padding: '1.25rem 0',
          marginBottom: '1.5rem'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            marginBottom: '1rem',
            padding: '0 0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={18} />
            <span>Players</span>
          </div>
          <span style={{ color: isDrawGame ? '#2A9D8F' : 'var(--accent-terracotta)', fontWeight: 800 }}>
            {currentCount} / {maxCount}
          </span>
        </div>

        {/* Slot rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
          {roomState.players.map((player) => (
            <div
              key={player.playerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.9rem',
                backgroundColor: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--accent-border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.85rem' }}>🟢</span>
                <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{player.name}</span>
              </div>

              {player.isHost && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: 'var(--accent-sand)',
                    color: 'var(--text-main)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px'
                  }}
                >
                  <Crown size={12} color="#D96B43" />
                  <span>HOST</span>
                </span>
              )}
            </div>
          ))}

          {/* Empty Waiting Slots */}
          {Array.from({ length: emptySlotsCount }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.65rem 0.9rem',
                backgroundColor: 'transparent',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--accent-border)',
                color: 'var(--text-light)',
                fontSize: '0.88rem'
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>⚪</span>
              <span>Waiting for player...</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '0.85rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Host: <strong>{hostPlayer?.name || 'Player'}</strong>
        </div>
      </div>

      {isHost ? (
        <div>
          <button
            onClick={handleStart}
            disabled={starting || !canStart}
            className="btn btn-primary btn-block"
            style={{
              fontSize: '1.05rem',
              padding: '1rem',
              marginBottom: '0.75rem',
              backgroundColor: isDrawGame ? '#2A9D8F' : undefined,
              borderColor: isDrawGame ? '#2A9D8F' : undefined
            }}
          >
            <Play size={18} />
            <span>{starting ? 'Starting...' : 'START GAME'}</span>
          </button>
          {!canStart && (
            <p style={{ fontSize: '0.825rem', color: 'var(--text-light)' }}>
              {isDrawGame
                ? 'Need at least 2 players to start Draw mo Ayusin mo.'
                : 'Waiting for players to join.'}
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: '1rem',
            background: 'var(--accent-sand)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)',
            fontSize: '0.95rem'
          }}
        >
          Waiting for the host ({hostPlayer?.name}) to start the game...
        </div>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <button
          onClick={onLeaveRoom}
          className="btn-subtle"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <LogOut size={16} />
          <span>Leave Room</span>
        </button>
      </div>
    </div>
  );
}
