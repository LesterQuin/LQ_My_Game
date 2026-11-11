import React, { useState } from 'react';

const REACTION_OPTIONS = [
  { emoji: '❤️', label: 'Love' },
  { emoji: '🫂', label: 'Hug' },
  { emoji: '🥺', label: 'Touched' },
  { emoji: '👏', label: 'Cheer' },
  { emoji: '☕', label: 'Cozy' }
];

export function FloatingReactions({ reactions = [], onSendReaction }) {
  const [activeBtn, setActiveBtn] = useState(null);

  const handleTap = (emoji) => {
    setActiveBtn(emoji);
    setTimeout(() => setActiveBtn(null), 300);
    if (onSendReaction) {
      onSendReaction(emoji);
    }
  };

  return (
    <>
      {/* Floating Emojis Overlay */}
      <div className="floating-reactions-overlay" aria-hidden="true">
        {reactions.map((rx) => (
          <div
            key={rx.id}
            className="floating-reaction-item"
            style={{
              left: `${rx.x || 50}%`
            }}
          >
            <span className="floating-emoji">{rx.emoji}</span>
            {rx.senderName && (
              <span className="floating-sender-tag">{rx.senderName}</span>
            )}
          </div>
        ))}
      </div>

      {/* Docked Reaction Toolbar */}
      <div className="reaction-bar-container">
        <div className="reaction-bar-label">
          <span>Tap to send silent encouragement</span>
        </div>
        <div className="reaction-bar-buttons">
          {REACTION_OPTIONS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleTap(item.emoji)}
              className={`reaction-bubble-btn ${activeBtn === item.emoji ? 'pressed' : ''}`}
              title={item.label}
              aria-label={`Send ${item.label} reaction`}
            >
              <span className="reaction-btn-emoji">{item.emoji}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
