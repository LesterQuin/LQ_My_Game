import React, { useState, useRef, useEffect } from 'react';
import { Send, CheckCircle2, Lock } from 'lucide-react';

export function GuessChat({
  messages = [],
  onSendGuess,
  isDrawer = false,
  hasGuessed = false,
  disabled = false
}) {
  const [guess, setGuess] = useState('');
  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = guess.trim();
    if (!clean || isDrawer || hasGuessed || disabled) return;

    if (onSendGuess) {
      onSendGuess(clean);
    }
    setGuess('');
  };

  return (
    <div className="guess-chat-panel">
      {/* Header */}
      <div className="guess-chat-header">
        <span>Live Guesses</span>
      </div>

      {/* Message Feed */}
      <div className="guess-chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty-hint">Guesses will appear here in real time...</div>
        )}

        {messages.map((msg, index) => {
          if (msg.type === 'CORRECT_GUESS') {
            return (
              <div key={index} className="chat-msg system-success">
                <CheckCircle2 size={14} />
                <span>
                  <strong>{msg.senderName}</strong> guessed the word!
                </span>
              </div>
            );
          }

          if (msg.type === 'CLOSE_GUESS') {
            return (
              <div key={index} className="chat-msg system-close">
                <span>⚠️ <strong>{msg.guess}</strong> is very close!</span>
              </div>
            );
          }

          if (msg.type === 'SYSTEM') {
            return (
              <div key={index} className="chat-msg system-info">
                <span>{msg.text}</span>
              </div>
            );
          }

          return (
            <div key={index} className="chat-msg user-guess">
              <span className="chat-sender">{msg.senderName}:</span>
              <span className="chat-text">{msg.text}</span>
            </div>
          );
        })}
        <div ref={chatBottomRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="guess-chat-form">
        {isDrawer ? (
          <div className="chat-status-bar drawer">
            <Lock size={15} />
            <span>You are drawing! Don't spoil the word.</span>
          </div>
        ) : hasGuessed ? (
          <div className="chat-status-bar guessed">
            <CheckCircle2 size={16} color="var(--accent-sage)" />
            <span>You guessed the word! Waiting for round to end.</span>
          </div>
        ) : (
          <div className="chat-input-wrapper">
            <input
              type="text"
              className="chat-input"
              placeholder="Type your guess..."
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              disabled={disabled}
              maxLength={40}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!guess.trim() || disabled}
              className="chat-send-btn"
              title="Submit guess"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
