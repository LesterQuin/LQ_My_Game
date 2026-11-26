import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, RotateCcw, Home as HomeIcon, Trophy, Clock, Edit3, CheckCircle2, HelpCircle, Lightbulb } from 'lucide-react';
import { DrawingCanvas } from '../components/DrawingCanvas.jsx';
import { GuessChat } from '../components/GuessChat.jsx';
import { ScoreBoard } from '../components/ScoreBoard.jsx';
import { getCategoriesSummary } from '../data/drawWords.js';

export function DrawGame({
  roomState,
  playerId,
  onSelectWord,
  onDrawSegment,
  onClearCanvas,
  onUndoStroke,
  onSubmitGuess,
  onGiveHint,
  onPlayAgain,
  onLeaveRoom
}) {
  const [loading, setLoading] = useState(false);

  // Confetti when game ends
  useEffect(() => {
    if (roomState?.status === 'FINISHED') {
      try {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.55 }
        });
      } catch (e) {}
    }
  }, [roomState?.status]);

  if (!roomState) return null;

  const {
    players = [],
    currentDrawerIndex = 0,
    currentRound = 1,
    totalRounds = 5,
    timerRemaining = 60,
    roundDuration = 60,
    status = 'LOBBY',
    currentWord,
    currentCategory,
    wordHint,
    wordLength,
    wordChoices = [],
    strokes = [],
    messages = [],
    lastRevealedWord
  } = roomState;

  const currentDrawer = players[currentDrawerIndex] || players[0];
  const isDrawer = currentDrawer?.playerId === playerId;
  const isHost = !roomState.hostPlayerId || roomState.hostPlayerId === playerId;
  const me = players.find((p) => p.playerId === playerId);
  const hasGuessed = !!me?.hasGuessed;

  const handlePlayAgain = async () => {
    try {
      setLoading(true);
      await onPlayAgain();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // Game Finished Podium Screen
  // =========================================================================
  if (status === 'FINISHED') {
    const ranked = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
    const winner = ranked[0];

    return (
      <div className="panel" style={{ maxWidth: '580px', margin: '0 auto' }}>
        <div className="podium-trophy-badge">
          <Trophy size={40} color="#D96B43" />
        </div>

        <h2 style={{ fontSize: '2.2rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
          Game Over!
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '2rem' }}>
          🎉 Congratulations to <strong>{winner?.name || 'Everyone'}</strong> for winning!
        </p>

        {/* Podium Top 3 */}
        <div className="podium-container">
          {ranked[1] && (
            <div className="podium-col second-place">
              <div className="podium-avatar">🥈</div>
              <div className="podium-name">{ranked[1].name}</div>
              <div className="podium-score">{ranked[1].score || 0} pts</div>
              <div className="podium-step step-2">2nd</div>
            </div>
          )}

          {winner && (
            <div className="podium-col first-place">
              <div className="podium-crown">👑</div>
              <div className="podium-avatar">🥇</div>
              <div className="podium-name">{winner.name}</div>
              <div className="podium-score">{winner.score || 0} pts</div>
              <div className="podium-step step-1">1st</div>
            </div>
          )}

          {ranked[2] && (
            <div className="podium-col third-place">
              <div className="podium-avatar">🥉</div>
              <div className="podium-name">{ranked[2].name}</div>
              <div className="podium-score">{ranked[2].score || 0} pts</div>
              <div className="podium-step step-3">3rd</div>
            </div>
          )}
        </div>

        {/* Full Ranks Table */}
        <div className="podium-full-ranks">
          <div className="ranks-header">Final Leaderboard</div>
          {ranked.map((p, idx) => (
            <div key={p.playerId} className="ranks-row">
              <span className="rank-pos">#{idx + 1}</span>
              <span className="rank-name">{p.name}</span>
              <span className="rank-points">{p.score || 0} pts</span>
            </div>
          ))}
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {isHost ? (
            <button
              onClick={handlePlayAgain}
              disabled={loading}
              className="btn btn-primary btn-block"
              style={{ padding: '0.95rem' }}
            >
              <RotateCcw size={18} />
              <span>PLAY AGAIN</span>
            </button>
          ) : (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', padding: '0.5rem' }}>
              Waiting for host to restart the game...
            </div>
          )}

          <button
            onClick={onLeaveRoom}
            className="btn btn-outline btn-block"
            style={{ padding: '0.95rem' }}
          >
            <HomeIcon size={18} />
            <span>RETURN TO HUB</span>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Active Game Screen (Selecting Word, Drawing, Intermission)
  // =========================================================================
  return (
    <div className="draw-game-wrapper">
      {/* Word Selection Overlay for Drawer */}
      {status === 'SELECTING_WORD' && isDrawer && (
        <div className="modal-backdrop">
          <div className="modal-card word-select-modal">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Edit3 size={24} color="var(--accent-terracotta)" />
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Choose a Word to Draw</h3>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.25rem' }}>
              {(() => {
                const summary = getCategoriesSummary(roomState.selectedCategory);
                return summary.isAll
                  ? 'Pick the word you want to sketch. Others will try to guess it!'
                  : `Active Categories: ${summary.title}. Pick one to sketch!`;
              })()}
            </p>

            <div className="word-choice-cards">
              {wordChoices.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => onSelectWord(word)}
                  className="word-choice-btn"
                >
                  <span className="word-choice-text">{word}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Waiting for Drawer to select word */}
      {status === 'SELECTING_WORD' && !isDrawer && (
        <div className="selection-waiting-banner">
          <Edit3 size={18} className="spin-slow" />
          <span><strong>{currentDrawer?.name}</strong> is choosing a secret word to draw...</span>
        </div>
      )}

      {/* Round Reveal Intermission */}
      {status === 'ROUND_REVEAL' && (
        <div className="modal-backdrop intermission">
          <div className="modal-card intermission-modal">
            <h3 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Round Over!
            </h3>
            <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              The secret word was:
            </div>
            <div className="revealed-word-badge">
              "{lastRevealedWord || currentWord}"
            </div>
            {currentDrawer && (
              <div className="drawer-round-summary-badge">
                <span>🎨 Drawer <strong>{currentDrawer.name}</strong> earned </span>
                <strong className="drawer-earned-pts">+{currentDrawer.roundScore || 0} pts</strong>
                <span> from correct guesses!</span>
              </div>
            )}
            <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '1rem' }}>
              Next turn starting shortly...
            </p>
          </div>
        </div>
      )}

      {/* Top Game Bar */}
      <div className="draw-header-bar">
        {/* Round Badge */}
        <div className="draw-badge round">
          <span>Round {currentRound} of {totalRounds}</span>
        </div>

        {/* Word Display / Word Hint */}
        <div className="draw-word-center">
          {isDrawer ? (
            <div className="drawer-word-pill">
              <span className="pill-prefix">DRAW THIS:</span>
              <strong className="pill-word">{currentWord}</strong>
              {currentCategory && <span className="pill-cat">({currentCategory})</span>}
              {status === 'DRAWING' && onGiveHint && (
                <button
                  type="button"
                  onClick={onGiveHint}
                  className="btn-give-hint"
                  title="Reveal a random letter hint for guessers"
                >
                  <Lightbulb size={14} />
                  <span>Give Hint</span>
                </button>
              )}
            </div>
          ) : hasGuessed ? (
            <div className="guesser-word-pill guessed">
              <CheckCircle2 size={16} color="var(--accent-sage)" />
              <strong className="pill-word">{currentWord}</strong>
              <span className="pill-cat">(Guessed!)</span>
            </div>
          ) : (
            <div className="guesser-word-pill hint">
              <span className="hint-letters">{wordHint || '_ _ _ _ _'}</span>
              {wordLength > 0 && <span className="hint-count">({wordLength} letters)</span>}
              {currentCategory && <span className="pill-cat">[{currentCategory}]</span>}
            </div>
          )}
        </div>

        {/* Round Timer Countdown */}
        <div className={`draw-badge timer ${timerRemaining <= 10 ? 'danger-pulse' : ''}`}>
          <Clock size={16} />
          <span>{timerRemaining}s</span>
        </div>
      </div>

      {/* Main Studio Drafting Easel Table */}
      <div className="draw-studio-table">
        {/* Main 3-Column / Responsive Game Layout */}
        <div className="draw-layout-grid" style={{ position: 'relative', zIndex: 2 }}>
          {/* Left Column: Player Leaderboard */}
          <div className="draw-col-scoreboard">
            <ScoreBoard
              players={players}
              currentDrawerId={currentDrawer?.playerId}
              currentUserId={playerId}
            />
          </div>

          {/* Center Column: Live Drawing Canvas */}
          <div className="draw-col-canvas">
            <DrawingCanvas
              isDrawer={isDrawer && status === 'DRAWING'}
              strokes={strokes}
              onDrawSegment={onDrawSegment}
              onClearCanvas={onClearCanvas}
              onUndoStroke={onUndoStroke}
            />
          </div>

          {/* Right Column: Live Guess Chat */}
          <div className="draw-col-chat">
            <GuessChat
              messages={messages}
              onSendGuess={onSubmitGuess}
              isDrawer={isDrawer}
              hasGuessed={hasGuessed}
              disabled={status !== 'DRAWING'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
