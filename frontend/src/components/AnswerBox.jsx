import React, { useState } from 'react';
import { Send } from 'lucide-react';

export function AnswerBox({ onSubmit, disabled }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setError('Please write a brief thought or answer.');
      return;
    }
    setError('');
    onSubmit(trimmed);
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '440px',
        margin: '0 auto',
        animation: 'fadeIn 0.4s ease-out'
      }}
    >
      <form onSubmit={handleSubmit} className="panel" style={{ padding: '1.5rem', textAlign: 'left' }}>
        <label
          htmlFor="answer-input"
          className="input-label"
          style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}
        >
          What's on your mind?
        </label>

        <textarea
          id="answer-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (error) setError('');
          }}
          placeholder="Share your thoughts honestly and at your own pace..."
          maxLength={500}
          rows={3}
          className="input-field"
          style={{ resize: 'vertical', minHeight: '80px', marginBottom: '0.5rem' }}
          disabled={disabled}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.8rem',
            color: 'var(--text-light)',
            marginBottom: '1rem'
          }}
        >
          <span>{error ? <span style={{ color: '#C84B31' }}>{error}</span> : 'Temporary answer — not stored permanently.'}</span>
          <span>{text.length}/500</span>
        </div>

        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="btn btn-primary btn-block"
        >
          <Send size={16} />
          <span>Submit Answer</span>
        </button>
      </form>
    </div>
  );
}
