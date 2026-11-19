import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export const HOST_PASSCODE = 'Lester!1';
const SESSION_AUTH_KEY = 'lq_host_session_auth';

/**
 * Checks if the host has unlocked the session.
 * Stored in sessionStorage so it resets when the session/temporary account is refreshed/closed.
 */
export function isHostUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_AUTH_KEY) === HOST_PASSCODE;
  } catch (e) {
    return false;
  }
}

/**
 * Unlocks the host privileges for this temporary session.
 */
export function unlockHost(passcode) {
  if ((passcode || '').trim() === HOST_PASSCODE) {
    try {
      sessionStorage.setItem(SESSION_AUTH_KEY, HOST_PASSCODE);
    } catch (e) {}
    return true;
  }
  return false;
}

/**
 * Re-locks host privileges.
 */
export function lockHost() {
  try {
    sessionStorage.removeItem(SESSION_AUTH_KEY);
  } catch (e) {}
}

/**
 * Host Passcode Modal
 * Prompts the user for 'Lester!1' before allowing them to create a room.
 */
export function HostPasscodeModal({ isOpen, onClose, onSuccess }) {
  const [passcode, setPasscode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (unlockHost(passcode)) {
      try {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.6 }
        });
      } catch (err) {}

      setError(false);
      setPasscode('');
      if (onSuccess) onSuccess();
    } else {
      setError(true);
      setPasscode('');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 9999
      }}
    >
      <div
        className="panel"
        style={{
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          position: 'relative',
          padding: '2rem 1.5rem',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-xl)'
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)'
          }}
          title="Close"
        >
          <X size={20} />
        </button>

        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-terracotta-subtle)',
            color: 'var(--accent-terracotta)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem'
          }}
        >
          <Lock size={26} />
        </div>

        <h3
          style={{
            fontSize: '1.45rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            marginBottom: '0.35rem'
          }}
        >
          Host Passcode Required
        </h3>

        <p
          style={{
            fontSize: '0.86rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            marginBottom: '1.35rem'
          }}
        >
          You must enter the host passcode to create a room and share game links.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '1rem', textAlign: 'left' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Enter host passcode"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError(false);
                }}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.7rem 2.6rem 0.7rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: error ? '2px solid #EF4444' : '1.5px solid var(--accent-border)',
                  fontSize: '0.92rem',
                  outline: 'none',
                  background: 'var(--bg-canvas)'
                }}
              />

              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '0.65rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={showPass ? 'Hide' : 'Show'}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <p style={{ color: '#DC2626', fontSize: '0.8rem', fontWeight: 600, marginTop: '0.35rem', marginBottom: 0 }}>
                Incorrect passcode. Please try again.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              style={{ flex: 1, padding: '0.7rem' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!passcode.trim()}
              className="btn btn-primary"
              style={{
                flex: 1.4,
                padding: '0.7rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <span>Unlock & Create</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '0.85rem',
            borderTop: '1px solid var(--accent-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            color: 'var(--text-light)'
          }}
        >
          <ShieldCheck size={13} color="#2A9D8F" />
          <span>Active for this browser session only</span>
        </div>
      </div>
    </div>
  );
}
