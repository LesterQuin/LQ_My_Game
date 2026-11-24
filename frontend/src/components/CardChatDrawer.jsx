import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export function CardChatDrawer({
  messages = [],
  currentUserId,
  onSendMessage
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [input, setInput] = useState('');
  const chatBottomRef = useRef(null);
  const inputRef = useRef(null);
  const prevMessagesLength = useRef(messages.length);

  // Filter only user CHAT messages or general messages
  const chatMessages = messages.filter((m) => m.type === 'CHAT' || (!m.type && m.text));

  // Handle unread badge calculation
  useEffect(() => {
    if (!isOpen && chatMessages.length > prevMessagesLength.current) {
      const newMessages = chatMessages.slice(prevMessagesLength.current);
      const others = newMessages.filter((m) => m.senderId !== currentUserId);
      if (others.length > 0) {
        setUnreadCount((prev) => prev + others.length);
      }
    }
    prevMessagesLength.current = chatMessages.length;
  }, [chatMessages, isOpen, currentUserId]);

  // Scroll to bottom when opening or new message arrives
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const clean = input.trim();
    if (!clean) return;

    if (onSendMessage) {
      onSendMessage(clean);
    }
    setInput('');
  };

  return (
    <>
      {/* Floating Chat Trigger Button (Always visible when closed) */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleOpen}
          className="card-chat-floating-btn"
          title="Open room chat"
          aria-label="Open room chat"
        >
          <MessageCircle size={18} />
          <span>Chat</span>
          {unreadCount > 0 && (
            <span className="card-chat-badge">{unreadCount}</span>
          )}
        </button>
      )}

      {/* Slide-out Chat Drawer */}
      {isOpen && (
        <div className="card-chat-overlay" onClick={handleClose}>
          <div
            className="card-chat-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Room Chat"
          >
            {/* Header */}
            <div className="card-chat-drawer-header">
              <div className="card-chat-header-info">
                <div className="card-chat-title">
                  <MessageCircle size={18} color="var(--accent-terracotta)" />
                  <span>Room Chat</span>
                </div>
                <span className="card-chat-sub">Share thoughts & kind notes</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="card-chat-close-btn"
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>

            {/* Message List */}
            <div className="card-chat-messages">
              {chatMessages.length === 0 ? (
                <div className="card-chat-empty">
                  <div className="card-chat-empty-icon">💬</div>
                  <p className="card-chat-empty-title">No messages yet</p>
                  <p className="card-chat-empty-desc">
                    Send a kind thought, comment, or react while someone is answering!
                  </p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => {
                  const isMe = msg.senderId === currentUserId;
                  const timeFormatted = msg.timestamp
                    ? new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : null;

                  return (
                    <div
                      key={msg.id || idx}
                      className={`card-chat-item ${isMe ? 'is-me' : 'is-other'}`}
                    >
                      <div className="card-chat-bubble">
                        {!isMe && (
                          <div className="card-chat-sender">{msg.senderName}</div>
                        )}
                        <div className="card-chat-text">{msg.text}</div>
                        {timeFormatted && (
                          <div className="card-chat-time">{timeFormatted}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="card-chat-footer">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a kind note or reaction..."
                className="card-chat-input"
                maxLength={300}
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="card-chat-send-btn"
                aria-label="Send message"
                title="Send"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
