import React, { useState } from 'react';
import { Copy, Check, Play, LogOut, Users, Share2, Crown } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard.js';

export function Lobby({ roomState, playerId, onStartGame, onLeaveRoom }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [starting, setStarting] = useState(false);

  if (!roomState) return null;

  const isHost = roomState.hostPlayerId === playerId;
  const hostPlayer = roomState.players.find((p) => p.isHost) || roomState.players[0];
  const inviteUrl = `${window.location.origin}${window.location.pathname}#/join/${roomState.roomCode}`;

  const currentCount = roomState.players.length;
  const maxCount = roomState.maxPlayers || 6;
  const emptySlotsCount = Math.max(0, maxCount - currentCount);

  const canStart = isHost && currentCount >= 1;

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
    <div className="panel" style={{ maxWidth: '500px' }}>
      <div
        style={{
          fontSize: '0.85rem',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          fontWeight: 600,
          marginBottom: '0.5rem'
        }}
      >
        Comfort Cards
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
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

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'center',
          marginBottom: '1.75rem',
          flexWrap: 'wrap'
        }}
      >
        <button
          onClick={handleCopyCode}
          className="btn btn-outline"
          style={{ fontSize: '0.875rem', padding: '0.55rem 1.15rem' }}
        >
          {copiedCode ? <Check size={16} color="var(--accent-sage)" /> : <Copy size={16} />}
          <span>{copiedCode ? 'Code Copied!' : 'Copy Room Code'}</span>
        </button>

        <button
          onClick={handleCopyLink}
          className="btn btn-secondary"
          style={{ fontSize: '0.875rem', padding: '0.55rem 1.15rem' }}
        >
          {copiedLink ? <Check size={16} color="var(--accent-sage)" /> : <Share2 size={16} />}
          <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
        </button>
      </div>

      {/* Players Slot List */}
      <div
        style={{
          borderTop: '1px solid var(--accent-border)',
          borderBottom: '1px solid var(--accent-border)',
          padding: '1.5rem 0',
          marginBottom: '1.75rem'
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
            marginBottom: '1.25rem',
            padding: '0 0.5rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={18} />
            <span>Players</span>
          </div>
          <span style={{ color: 'var(--accent-terracotta)', fontWeight: 800 }}>
            {currentCount} / {maxCount}
          </span>
        </div>

        {/* Slot rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left' }}>
          {roomState.players.map((player) => (
            <div
              key={player.playerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
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
                padding: '0.75rem 1rem',
                backgroundColor: 'transparent',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--accent-border)',
                color: 'var(--text-light)',
                fontSize: '0.9rem'
              }}
            >
              <span style={{ fontSize: '0.85rem' }}>⚪</span>
              <span>Waiting for player...</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Host: <strong>{hostPlayer?.name || 'Lester'}</strong>
        </div>
      </div>

      {isHost ? (
        <div>
          <button
            onClick={handleStart}
            disabled={starting || !canStart}
            className="btn btn-primary btn-block"
            style={{ fontSize: '1.05rem', padding: '1rem', marginBottom: '0.75rem' }}
          >
            <Play size={18} />
            <span>{starting ? 'Starting...' : 'START GAME'}</span>
          </button>
          {!canStart && (
            <p style={{ fontSize: '0.825rem', color: 'var(--text-light)' }}>
              Waiting for at least 1 more player to join (minimum 2 players).
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
