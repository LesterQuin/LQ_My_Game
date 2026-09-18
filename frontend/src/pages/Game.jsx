import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, RotateCcw, Home as HomeIcon, Heart, ArrowRight, MessageCircle, Lightbulb } from 'lucide-react';
import { PlayerList } from '../components/PlayerList.jsx';
import { SampleAnswerModal } from '../components/SampleAnswerModal.jsx';

export function Game({
  roomState,
  playerId,
  onNextQuestion,
  onPlayAgain,
  onLeaveRoom
}) {
  const [loading, setLoading] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);

  // Confetti when all cards are completed
  useEffect(() => {
    if (roomState?.status === 'FINISHED') {
      try {
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (e) {}
    }
  }, [roomState?.status]);

  // Close sample modal whenever the active card changes
  useEffect(() => {
    setShowSampleModal(false);
  }, [roomState?.currentCardIndex]);

  if (!roomState) return null;

  const {
    players = [],
    currentPlayerIndex = 0,
    currentCard,
    currentCardIndex = 0,
    totalCards = 60,
    cardsRemaining = 0,
    status
  } = roomState;

  const currentPlayer = players[currentPlayerIndex] || players[0];
  const isMyTurn = currentPlayer?.playerId === playerId;
  const isHost = !roomState.hostPlayerId || roomState.hostPlayerId === playerId || players.length <= 1;

  const handleNext = async () => {
    // Strictly enforce host-only permission
    if (!isHost) return;

    try {
      setLoading(true);
      setShowSampleModal(false);
      await onNextQuestion();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayAgain = async () => {
    try {
      setLoading(true);
      setShowSampleModal(false);
      await onPlayAgain();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Game Complete Screen
  if (status === 'FINISHED') {
    return (
      <div className="panel" style={{ maxWidth: '500px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            backgroundColor: 'var(--accent-terracotta-subtle)',
            borderRadius: '50%',
            marginBottom: '1.25rem'
          }}
        >
          <Heart size={32} color="var(--accent-terracotta)" fill="var(--accent-terracotta)" />
        </div>

        <h2 style={{ fontSize: '2rem', marginBottom: '0.75rem', color: 'var(--text-main)' }}>
          Your game is complete ❤️
        </h2>

        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          You made it through all 60 cards together. Thank you for holding space and sharing your thoughts.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            background: 'var(--bg-canvas)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '2rem',
            border: '1px solid var(--accent-border)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
              PLAYERS
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {players.length}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>
              CARDS EXPLORED
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-terracotta)' }}>
              {totalCards}
            </div>
          </div>
        </div>

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
            <span>RETURN HOME</span>
          </button>
        </div>
      </div>
    );
  }

  // Determine question texts
  const tagalogText = currentCard?.tagalog || currentCard?.question || '';
  const englishText = currentCard?.english || '';
  const categoryName = currentCard?.category || 'Comfort & Reflection';

  return (
    <div style={{ width: '100%', maxWidth: '620px', margin: '0 auto', textAlign: 'center' }}>
      {/* Current Turn Indicator */}
      <div
        className={`turn-banner ${isMyTurn ? 'my-turn' : ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          backgroundColor: isMyTurn ? 'var(--accent-terracotta-subtle)' : 'var(--bg-card)',
          border: `1.5px solid ${isMyTurn ? 'var(--accent-terracotta)' : 'var(--accent-border)'}`,
          padding: '0.45rem 1.25rem',
          borderRadius: 'var(--radius-pill)',
          marginBottom: '1.5rem',
          fontSize: '0.95rem',
          fontWeight: 600,
          boxShadow: isMyTurn ? '0 4px 12px rgba(217, 107, 67, 0.15)' : 'none'
        }}
      >
        <MessageCircle size={16} />
        <span>
          {isMyTurn
            ? "It's your turn to read & answer verbally"
            : `${currentPlayer?.name}'s turn to share`}
        </span>
      </div>

      {/* Ornate Designed Conversation Card */}
      <div className="card-wrapper">
        <div className="comfort-card-physical">
          {/* Corner Filigree Ornaments */}
          <div className="card-corner corner-tl" />
          <div className="card-corner corner-tr" />
          <div className="card-corner corner-bl" />
          <div className="card-corner corner-br" />

          {/* Top Header Bar */}
          <div className="card-top-bar">
            <div className="card-theme-tag">
              <Sparkles size={12} />
              <span>{categoryName}</span>
            </div>
            <div className="card-num-badge">
              Question {currentCardIndex + 1} of {totalCards}
            </div>
          </div>

          {/* Question Content Area */}
          <div className="card-content-area">
            {/* Primary Tagalog Question */}
            <div className="card-primary-question">
              "{tagalogText}"
            </div>

            {/* Ornate Divider with Gem Accent */}
            {englishText && (
              <div className="card-ornate-divider">
                <span>✦</span>
              </div>
            )}

            {/* English Translation */}
            {englishText && (
              <div className="card-english-translation">
                <span className="translation-label">English Translation</span>
                "{englishText}"
              </div>
            )}
          </div>

          {/* Card Middle Button: View Sample Answer */}
          {(currentCard?.sampleAnswerTagalog || currentCard?.sampleAnswerEnglish) && (
            <div style={{ margin: '1rem 0 0.5rem', zIndex: 4 }}>
              <button
                type="button"
                onClick={() => setShowSampleModal(true)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.875rem',
                  padding: '0.55rem 1.25rem',
                  border: '1px solid var(--accent-border)',
                  backgroundColor: '#FFFDF9',
                  boxShadow: '0 2px 6px rgba(45, 41, 38, 0.04)'
                }}
              >
                <Lightbulb size={15} color="#D96B43" />
                <span>View Sample Answer</span>
              </button>
            </div>
          )}

          {/* Card Footer */}
          <div className="card-bottom-footer">
            <div className="card-instruction-note">
              Read aloud and discuss naturally together.
            </div>
            <div className="card-deck-seal">
              Comfort Cards • 60-Card Conversation Deck
            </div>
          </div>
        </div>
      </div>

      {/* Card Controls: NEXT QUESTION (HOST ONLY) */}
      <div style={{ marginBottom: '2rem' }}>
        {isHost ? (
          <div>
            <button
              onClick={handleNext}
              disabled={loading}
              className="btn btn-primary"
              style={{
                fontSize: '1.05rem',
                padding: '0.95rem 2.25rem',
                boxShadow: '0 6px 20px rgba(217, 107, 67, 0.28)'
              }}
            >
              <span>Next Question</span>
              <ArrowRight size={18} />
            </button>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Cards remaining in deck: <strong>{cardsRemaining}</strong>
            </div>
          </div>
        ) : (
          <div>
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1.5px dashed var(--accent-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.1rem 1.5rem',
                maxWidth: '440px',
                margin: '0 auto',
                color: 'var(--text-muted)',
                fontSize: '0.92rem',
                lineHeight: 1.5
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem', fontSize: '1rem' }}>
                Waiting for the host...
              </div>
              <div>The host will move to the next question when everyone is ready.</div>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
              Cards remaining in deck: <strong>{cardsRemaining}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Connected Players Roster */}
      <div style={{ borderTop: '1px solid var(--accent-border)', paddingTop: '1.5rem' }}>
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-light)',
            marginBottom: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 600
          }}
        >
          Players in Room ({players.length})
        </div>

        <PlayerList
          players={players}
          currentPlayerIndex={currentPlayerIndex}
          status={status}
        />
      </div>

      {/* Sample Answer Modal */}
      <SampleAnswerModal
        isOpen={showSampleModal}
        onClose={() => setShowSampleModal(false)}
        tagalogAnswer={currentCard?.sampleAnswerTagalog}
        englishAnswer={currentCard?.sampleAnswerEnglish}
      />
    </div>
  );
}
