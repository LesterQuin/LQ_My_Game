import React, { useState } from 'react';
import { X, Lightbulb, Sparkles, Globe } from 'lucide-react';

export function SampleAnswerModal({
  isOpen,
  onClose,
  tagalogAnswer,
  englishAnswer
}) {
  const [selectedLang, setSelectedLang] = useState(null); // null | 'TL' | 'EN'

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(45, 41, 38, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '2rem',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          borderRadius: 'var(--radius-xl)',
          position: 'relative',
          textAlign: 'center',
          animation: 'slideUp 0.25s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn-subtle"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '0.4rem',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Close sample answer"
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            backgroundColor: 'var(--accent-terracotta-subtle)',
            color: 'var(--accent-terracotta)',
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '1rem'
          }}
        >
          <Lightbulb size={14} />
          <span>Sample Answer</span>
        </div>

        {/* If no language is selected yet: Language Choice View */}
        {!selectedLang ? (
          <div>
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
              Choose a Language
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
              Select a language to view an example response for this question.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <button
                onClick={() => setSelectedLang('TL')}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  padding: '0.9rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>🇵🇭</span>
                <span>Tagalog</span>
              </button>

              <button
                onClick={() => setSelectedLang('EN')}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  padding: '0.9rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>🇺🇸</span>
                <span>English</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="btn btn-outline btn-block"
              style={{ padding: '0.75rem' }}
            >
              Close
            </button>
          </div>
        ) : (
          /* Language Selected View */
          <div>
            {/* Language Switcher Bar */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-canvas)',
                padding: '0.25rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--accent-border)',
                marginBottom: '1.5rem'
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedLang('TL')}
                style={{
                  border: 'none',
                  background: selectedLang === 'TL' ? 'var(--accent-terracotta)' : 'transparent',
                  color: selectedLang === 'TL' ? '#FFFFFF' : 'var(--text-muted)',
                  padding: '0.4rem 1rem',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>🇵🇭</span>
                <span>Tagalog</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedLang('EN')}
                style={{
                  border: 'none',
                  background: selectedLang === 'EN' ? 'var(--accent-terracotta)' : 'transparent',
                  color: selectedLang === 'EN' ? '#FFFFFF' : 'var(--text-muted)',
                  padding: '0.4rem 1rem',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span>🇺🇸</span>
                <span>English</span>
              </button>
            </div>

            {/* Answer Quote Box */}
            <div
              style={{
                backgroundColor: 'var(--bg-canvas)',
                border: '1.5px solid var(--accent-border)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.5rem',
                marginBottom: '1.25rem',
                textAlign: 'left',
                position: 'relative'
              }}
            >
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-terracotta)',
                  marginBottom: '0.6rem'
                }}
              >
                {selectedLang === 'TL' ? '🇵🇭 Tagalog Sample Answer' : '🇺🇸 English Sample Answer'}
              </div>

              <p
                style={{
                  fontSize: '1.05rem',
                  lineHeight: 1.6,
                  color: 'var(--text-main)',
                  fontStyle: 'italic'
                }}
              >
                "{selectedLang === 'TL' ? tagalogAnswer : englishAnswer}"
              </p>
            </div>

            {/* Subtext Disclaimer */}
            <div
              style={{
                fontSize: '0.825rem',
                color: 'var(--text-light)',
                lineHeight: 1.5,
                marginBottom: '1.5rem'
              }}
            >
              <p>This is only an example to spark thoughts.</p>
              <p>There is no right or wrong answer.</p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                onClick={onClose}
                className="btn btn-primary btn-block"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
