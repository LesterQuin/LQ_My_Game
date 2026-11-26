import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Users,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Crown,
  Play,
  Layers,
  AlertCircle,
  MessageCircle,
  Send,
  LogOut
} from 'lucide-react';
import { getUnoPeerManager } from '../services/unoPeerService.js';
import { isHostUnlocked, HostPasscodeModal } from '../components/PasswordGate.jsx';
import { COLOR_CONFIG, UNO_COLORS, canPlayCard } from '../data/unoDeck.js';
import { CardChatDrawer } from '../components/CardChatDrawer.jsx';

function getOpponentSeatStyle(index, totalOpponents) {
  if (totalOpponents === 1) {
    // 2 players: 1 opponent directly opposite you at top center
    return { top: '20px', left: '50%', transform: 'translateX(-50%)' };
  }
  if (totalOpponents === 2) {
    // 3 players: 2 opponents at Top-Left and Top-Right
    return index === 0
      ? { top: '28px', left: '22%', transform: 'translateX(-50%)' }
      : { top: '28px', right: '22%', transform: 'translateX(50%)' };
  }
  if (totalOpponents === 3) {
    // 4 players (Left, Top Center, Right) - User's exact layout!
    if (index === 0) return { top: '48%', left: '20px', transform: 'translateY(-50%)' };
    if (index === 1) return { top: '20px', left: '50%', transform: 'translateX(-50%)' };
    return { top: '48%', right: '20px', transform: 'translateY(-50%)' };
  }
  if (totalOpponents === 4) {
    // 5 players: Mid-Left, Top-Left, Top-Right, Mid-Right
    if (index === 0) return { top: '56%', left: '20px', transform: 'translateY(-50%)' };
    if (index === 1) return { top: '22px', left: '25%', transform: 'translateX(-50%)' };
    if (index === 2) return { top: '22px', right: '25%', transform: 'translateX(50%)' };
    return { top: '56%', right: '20px', transform: 'translateY(-50%)' };
  }
  if (totalOpponents === 5) {
    // 6 players: Bottom-Left, Top-Left, Top Center, Top-Right, Bottom-Right
    if (index === 0) return { top: '62%', left: '20px', transform: 'translateY(-50%)' };
    if (index === 1) return { top: '26px', left: '20%', transform: 'translate(-50%, -50%)' };
    if (index === 2) return { top: '18px', left: '50%', transform: 'translateX(-50%)' };
    if (index === 3) return { top: '26px', right: '20%', transform: 'translate(50%, -50%)' };
    return { top: '62%', right: '20px', transform: 'translateY(-50%)' };
  }
  // 6+ players: semi-ellipse calculation along top perimeter
  const angle = Math.PI - (Math.PI * (index + 0.5)) / totalOpponents;
  const xPercent = Math.round(50 + 38 * Math.cos(angle));
  const yPercent = Math.round(48 - 34 * Math.sin(angle));
  return { top: `${yPercent}%`, left: `${xPercent}%`, transform: 'translate(-50%, -50%)' };
}

export function UnoGame() {
  const { initialRoom: routeRoom } = useParams();
  const initialRoom = routeRoom || '';
  const navigate = useNavigate();

  const [playerName, setPlayerName] = useState(() => {
    // When joining from link, leave initial input blank with placeholder 'Ace' so user can freely type
    if (initialRoom) return '';
    return sessionStorage.getItem('cc_player_name') || localStorage.getItem('matinik_player_name') || '';
  });
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [joinInputCode, setJoinInputCode] = useState(initialRoom || '');

  // Peer Manager and live state
  const [onlineStatus, setOnlineStatus] = useState('idle'); // 'idle' | 'creating' | 'joining' | 'connected'
  const [onlineMessage, setOnlineMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);

  // UNO Live State
  const [gameState, setGameState] = useState('LOBBY'); // 'LOBBY' | 'PLAYING' | 'FINISHED'
  const [roomCode, setRoomCode] = useState(initialRoom || '');
  const [myPlayerId, setMyPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [myHand, setMyHand] = useState([]);
  const [topCard, setTopCard] = useState(null);
  const [activeColor, setActiveColor] = useState('RED');
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState(null);
  const [direction, setDirection] = useState(1);
  const [winner, setWinner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [drawPileCount, setDrawPileCount] = useState(0);
  const [pendingDrawCount, setPendingDrawCount] = useState(0);

  // In-game chat input
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  // Wild Color Picker Modal State
  const [pendingWildCard, setPendingWildCard] = useState(null);
  const [hasDrawnThisTurn, setHasDrawnThisTurn] = useState(false);

  const peerManagerRef = useRef(null);

  const getPeerManager = () => {
    if (!peerManagerRef.current) {
      const pm = getUnoPeerManager();

      pm.onPlayersUpdate = (updatedPlayers) => {
        setPlayers([...updatedPlayers]);
      };

      pm.onStateUpdate = (state) => {
        setGameState(state.gameState);
        setRoomCode(state.roomCode);
        setPlayers([...(state.players || [])]);
        setMyPlayerId(state.playerId);
        setIsHost(state.isHost);
        setMyHand([...(state.myHand || [])]);
        setTopCard(state.topCard ? { ...state.topCard } : null);
        setActiveColor(state.activeColor || 'RED');
        setCurrentTurnPlayerId(state.currentTurnPlayerId);
        setDirection(state.direction);
        setWinner(state.winner ? { ...state.winner } : null);
        setMessages([...(state.messages || [])]);
        setDrawPileCount(state.drawPileCount || 0);
        setPendingDrawCount(state.pendingDrawCount || 0);

        if (state.currentTurnPlayerId !== state.playerId) {
          setHasDrawnThisTurn(false);
        } else if (state.hasDrawnThisTurn !== undefined) {
          setHasDrawnThisTurn(!!state.hasDrawnThisTurn);
        }
      };

      pm.onToast = (msg, type = 'info') => {
        setOnlineMessage(msg);
        setTimeout(() => setOnlineMessage(''), 4000);
      };

      pm.onError = (err) => {
        setOnlineMessage(typeof err === 'string' ? err : err.message || 'Connection error.');
      };

      peerManagerRef.current = pm;
    }
    return peerManagerRef.current;
  };

  const handleLeaveRoom = () => {
    if (peerManagerRef.current) {
      peerManagerRef.current.leaveRoom();
    }
    setOnlineStatus('idle');
    setGameState('LOBBY');
    setPlayers([]);
    setMyHand([]);
    setTopCard(null);
    setRoomCode('');
    navigate('/uno', { replace: true });
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (peerManagerRef.current) {
        peerManagerRef.current.leaveRoom();
      }
    };
  }, []);

  // Confetti on win
  useEffect(() => {
    if (gameState === 'FINISHED' && winner) {
      try {
        confetti({ particleCount: 140, spread: 90, origin: { y: 0.5 } });
      } catch (e) {}
    }
  }, [gameState, winner]);

  // Host room creation
  const executeCreateRoom = async () => {
    const finalName = playerName.trim() || 'Ace';
    sessionStorage.setItem('cc_player_name', finalName);
    setPlayerName(finalName);

    setOnlineStatus('creating');
    const pm = getPeerManager();

    try {
      const res = await pm.createRoom({ name: finalName, maxPlayers });
      setRoomCode(res.roomCode);
      setMyPlayerId(res.playerId);
      setPlayers([...(res.players || [])]);
      setIsHost(true);
      setOnlineStatus('connected');
      navigate(`/uno/${res.roomCode}`, { replace: true });
    } catch (err) {
      setOnlineStatus('idle');
      setOnlineMessage(err.message || 'Failed to create room.');
    }
  };

  const handleHostClick = () => {
    if (isHostUnlocked()) {
      executeCreateRoom();
    } else {
      setShowPassModal(true);
    }
  };

  // Guest Join
  const handleJoinRoom = async (codeToJoin) => {
    const cleanCode = (codeToJoin || joinInputCode || '').trim().toUpperCase();
    if (!cleanCode) {
      setOnlineMessage('Please enter a room code.');
      return;
    }
    const finalName = playerName.trim() || 'Ace';
    sessionStorage.setItem('cc_player_name', finalName);
    setPlayerName(finalName);

    setOnlineStatus('joining');
    const pm = getPeerManager();

    try {
      const res = await pm.joinRoom({ roomCode: cleanCode, name: finalName });
      setRoomCode(res.roomCode);
      setMyPlayerId(res.playerId);
      setPlayers([...(pm.players || [])]);
      setIsHost(false);
      setOnlineStatus('connected');
      navigate(`/uno/${res.roomCode}`, { replace: true });
    } catch (err) {
      setOnlineStatus('idle');
      setOnlineMessage(err.message || 'Failed to join room.');
    }
  };

  const handleStartGame = () => {
    const pm = getPeerManager();
    pm.hostStartGame();
  };

  const handleCardClick = (card) => {
    if (currentTurnPlayerId !== myPlayerId) return;

    if (!canPlayCard(card, topCard, activeColor, pendingDrawCount)) {
      if (pendingDrawCount > 0) {
        setOnlineMessage(`🔥 Active Stack! You must drop a matching plus card (+2 or +4) or draw +${pendingDrawCount} cards!`);
      } else {
        setOnlineMessage("That card cannot be played on the discard pile!");
      }
      setTimeout(() => setOnlineMessage(''), 2500);
      return;
    }

    if (card.color === 'WILD') {
      setPendingWildCard(card);
    } else {
      const pm = getPeerManager();
      pm.playCard(card.id, null);
      setHasDrawnThisTurn(false);
    }
  };

  const handleSelectWildColor = (color) => {
    if (!pendingWildCard) return;
    const pm = getPeerManager();
    pm.playCard(pendingWildCard.id, color);
    setPendingWildCard(null);
    setHasDrawnThisTurn(false);
  };

  const handleDrawCard = () => {
    if (currentTurnPlayerId !== myPlayerId) return;
    if (pendingDrawCount === 0 && hasDrawnThisTurn) return;
    const pm = getPeerManager();
    pm.drawCard();
    if (pendingDrawCount === 0) {
      setHasDrawnThisTurn(true);
    } else {
      setHasDrawnThisTurn(false);
    }
  };

  const handlePassTurn = () => {
    if (currentTurnPlayerId !== myPlayerId || !hasDrawnThisTurn || pendingDrawCount > 0) return;
    const pm = getPeerManager();
    pm.passTurn();
    setHasDrawnThisTurn(false);
  };

  const handleCallUno = () => {
    const pm = getPeerManager();
    pm.callUno();
  };

  const handleCatchPlayerUno = (targetPId) => {
    const pm = getPeerManager();
    pm.catchUno(targetPId);
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInviteLink = () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#/uno/${roomCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    const pm = getPeerManager();
    pm.sendChatMessage(text.trim());
  };

  const isMyTurn = currentTurnPlayerId === myPlayerId;
  const currentTurnPlayer = players.find((p) => p.id === currentTurnPlayerId);
  const myPlayer = players.find((p) => p.id === myPlayerId) || { name: playerName, cardCount: myHand.length, isHost };
  const hasPlayableCard = myHand.some((card) => canPlayCard(card, topCard, activeColor, pendingDrawCount));

  // Calculate opponents seated relative to me (clockwise)
  const myIndex = players.findIndex((p) => p.id === myPlayerId);
  const opponents = [];
  if (myIndex !== -1 && players.length > 1) {
    for (let i = 1; i < players.length; i++) {
      const idx = (myIndex + i) % players.length;
      opponents.push(players[idx]);
    }
  } else {
    opponents.push(...players.filter((p) => p.id !== myPlayerId));
  }

  return (
    <div style={{ width: '100%', maxWidth: '960px', margin: '0 auto', textAlign: 'center' }}>
      {/* Header Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', padding: '0 0.5rem' }}>
        <Link to="/" className="btn-subtle" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}>
          <ArrowLeft size={16} />
          <span>Back to Game</span>
        </Link>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#FEE2E2', color: '#DC2626', padding: '0.35rem 0.9rem', borderRadius: 'var(--radius-pill)', fontWeight: 800, fontSize: '0.88rem' }}>
          <span>🎴 Uno ni Les</span>
        </div>

        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {onlineStatus === 'connected' ? (
            <>
              <span>Room: {roomCode}</span>
              <button
                type="button"
                onClick={handleLeaveRoom}
                className="btn-subtle"
                style={{ padding: '0.2rem 0.5rem', color: '#DC2626', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem' }}
                title="Leave Room"
              >
                <LogOut size={13} />
                <span>Leave</span>
              </button>
            </>
          ) : (
            'Local / Online'
          )}
        </div>
      </div>

      {onlineMessage && (
        <div style={{ background: '#FEF3C7', border: '1.5px solid #F59E0B', color: '#92400E', padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontWeight: 600, fontSize: '0.9rem' }}>
          {onlineMessage}
        </div>
      )}

      {/* SETUP SCREEN */}
      {onlineStatus !== 'connected' && (
        <div className="panel" style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', background: '#FEE2E2', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid #FCA5A5' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#DC2626', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.4rem' }}>
              U
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>Uno ni Les</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Classic Multiplayer Uno Card Game</div>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="uno-name-input" className="input-label">Your Nickname</label>
            <input
              id="uno-name-input"
              type="text"
              className="input-field"
              placeholder="Ace"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>

          {initialRoom ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                <label className="input-label">Room Code</label>
                <div style={{ padding: '0.85rem', background: '#FEE2E2', border: '1.5px dashed #DC2626', borderRadius: 'var(--radius-md)', fontSize: '1.5rem', fontWeight: 900, color: '#DC2626', letterSpacing: '2px', textAlign: 'center' }}>
                  {initialRoom}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleJoinRoom(initialRoom)}
                className="btn btn-primary btn-block"
                style={{ padding: '0.95rem', fontSize: '1.05rem', fontWeight: 800, backgroundColor: '#DC2626', borderColor: '#DC2626' }}
              >
                <span>JOIN UNO MATCH</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/uno')}
                className="btn btn-subtle"
                style={{ width: '100%', padding: '0.65rem', textAlign: 'center', justifyContent: 'center' }}
              >
                <span>Or Create New Room</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#FFFDF9', border: '1.5px solid var(--accent-border)', borderRadius: 'var(--radius-md)', padding: '1.15rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '1rem', color: 'var(--text-main)', fontWeight: 800, fontSize: '0.95rem' }}>
                  <Crown size={16} color="#DC2626" />
                  <span>Host a New Uno Match</span>
                </div>

                <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="input-label" style={{ fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                    Max Players
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                    {[2, 3, 4, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxPlayers(num)}
                        className={`btn ${maxPlayers === num ? 'btn-primary' : 'btn-outline'}`}
                        style={{ padding: '0.5rem 0.2rem', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        {num} Players
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleHostClick}
                  className="btn btn-primary btn-block"
                  style={{ padding: '0.9rem', fontWeight: 800, backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  <span>CREATE UNO ROOM</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 600 }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--accent-border)' }} />
                <span>OR JOIN EXISTING ROOM</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--accent-border)' }} />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label htmlFor="uno-room-code-input" className="input-label">Room Code</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    id="uno-room-code-input"
                    type="text"
                    className="input-field"
                    placeholder="e.g. 8K2M9P"
                    value={joinInputCode}
                    onChange={(e) => setJoinInputCode(e.target.value.toUpperCase().slice(0, 6))}
                    maxLength={6}
                    style={{ letterSpacing: '2px', fontWeight: 800, textTransform: 'uppercase' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleJoinRoom()}
                    disabled={!joinInputCode.trim()}
                    className="btn btn-secondary"
                    style={{ padding: '0 1.25rem', fontWeight: 800 }}
                  >
                    JOIN
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONNECTED ROOM: LOBBY OR ACTIVE MATCH */}
      {onlineStatus === 'connected' && (
        <div className="panel" style={{ maxWidth: '820px', margin: '0 auto', padding: '1.5rem' }}>
          {/* LOBBY VIEW */}
          {gameState === 'LOBBY' && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>ROOM CODE</div>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, letterSpacing: '0.2em', color: '#DC2626', fontFamily: 'monospace' }}>
                {roomCode}
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', margin: '1rem 0 1.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={handleCopyCode} className="btn btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 700 }}>
                  <Copy size={14} />
                  <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
                </button>
                <button type="button" onClick={handleCopyInviteLink} className="btn btn-secondary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 700 }}>
                  <Check size={14} />
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, marginBottom: '0.75rem' }}>
                  <span>Connected Players ({players.length} / {maxPlayers})</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                  {players.map((p) => (
                    <div key={p.id} style={{ padding: '0.85rem', background: p.id === myPlayerId ? '#FEE2E2' : 'var(--bg-canvas)', border: `1.5px solid ${p.id === myPlayerId ? '#DC2626' : 'var(--accent-border)'}`, borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>{p.isHost ? '👑' : '👤'}</div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.isHost ? 'Host' : 'Ready'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {isHost ? (
                <button
                  type="button"
                  onClick={handleStartGame}
                  disabled={players.length < 2}
                  className="btn btn-primary btn-block"
                  style={{ padding: '1rem', fontSize: '1.1rem', fontWeight: 800, backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  <Play size={18} />
                  <span>{players.length < 2 ? 'WAITING FOR AT LEAST 2 PLAYERS...' : 'DEAL CARDS & START UNO'}</span>
                </button>
              ) : (
                <div style={{ padding: '1rem', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Waiting for Host to deal cards and start the match...
                </div>
              )}
              {/* Leave Room from Lobby */}
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="btn-subtle"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#DC2626', fontSize: '0.85rem' }}
                >
                  <LogOut size={15} />
                  <span>Leave Room</span>
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE GAME BOARD: ROUND UNO FELT TABLE */}
          {gameState === 'PLAYING' && (
            <div>
              {/* Turn Banner */}
              <div
                style={{
                  padding: '0.45rem 1.25rem',
                  background: isMyTurn ? 'linear-gradient(135deg, #DC2626, #B91C1C)' : 'var(--bg-canvas)',
                  color: isMyTurn ? '#FFF' : 'var(--text-main)',
                  border: isMyTurn ? '2px solid #FCD34D' : '1.5px solid var(--accent-border)',
                  borderRadius: 'var(--radius-pill)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  marginBottom: '1rem',
                  boxShadow: isMyTurn ? '0 0 16px rgba(220, 38, 38, 0.5)' : 'none'
                }}
              >
                <span>{isMyTurn ? "👉 IT'S YOUR TURN!" : `⏳ Waiting for ${currentTurnPlayer?.name || 'opponent'}...`}</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                  ({direction === 1 ? '↻ Clockwise' : '↺ Counter-Clockwise'})
                </span>
              </div>

              {/* THE ROUND CASINO/FELT CARD TABLE */}
              <div
                className="uno-round-table"
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '840px',
                  minHeight: '460px',
                  margin: '0 auto 1.25rem',
                  borderRadius: '160px',
                  background: 'radial-gradient(ellipse at center, #15803D 0%, #166534 45%, #0F4C25 80%, #0A3318 100%)',
                  border: '12px solid #3B2214',
                  boxShadow: 'inset 0 0 50px rgba(0,0,0,0.65), 0 16px 36px rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  userSelect: 'none'
                }}
              >
                {/* Inner Stitched Line on Felt */}
                <div
                  style={{
                    position: 'absolute',
                    inset: '16px',
                    borderRadius: '144px',
                    border: '1.5px dashed rgba(254, 240, 138, 0.22)',
                    pointerEvents: 'none'
                  }}
                />

                {/* Felt Center Watermark */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontSize: '4.5rem',
                    fontWeight: 900,
                    color: 'rgba(255,255,255,0.04)',
                    letterSpacing: '8px',
                    pointerEvents: 'none',
                    fontFamily: 'Impact, sans-serif'
                  }}
                >
                  UNO
                </div>

                {/* OPPONENTS SEATED AROUND THE CIRCULAR TABLE */}
                {opponents.map((p, idx) => {
                  const isTurn = p.id === currentTurnPlayerId;
                  const seatStyle = getOpponentSeatStyle(idx, opponents.length);

                  return (
                    <div
                      key={p.id}
                      style={{
                        position: 'absolute',
                        ...seatStyle,
                        zIndex: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        pointerEvents: 'auto',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {/* Opponent Pill (Avatar & Name) */}
                      <div
                        style={{
                          padding: '0.35rem 0.75rem',
                          background: isTurn ? '#FEF3C7' : 'rgba(15, 23, 42, 0.9)',
                          border: isTurn ? '2.5px solid #F59E0B' : '1.5px solid rgba(255,255,255,0.25)',
                          borderRadius: 'var(--radius-pill)',
                          color: isTurn ? '#92400E' : '#FFF',
                          boxShadow: isTurn
                            ? '0 0 16px rgba(245, 158, 11, 0.85), 0 4px 10px rgba(0,0,0,0.3)'
                            : '0 4px 10px rgba(0,0,0,0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          backdropFilter: 'blur(4px)'
                        }}
                      >
                        <span>{p.isHost ? '👑' : '👤'}</span>
                        <span style={{ maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        {isTurn && (
                          <span style={{ fontSize: '0.68rem', background: '#F59E0B', color: '#000', padding: '0.1rem 0.35rem', borderRadius: '6px', fontWeight: 900 }}>
                            TURN
                          </span>
                        )}
                      </div>

                      {/* Mini Visual Cards Fan */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '4px',
                          background: 'rgba(0,0,0,0.45)',
                          padding: '0.15rem 0.55rem',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                        }}
                      >
                        <div style={{ display: 'flex', position: 'relative', width: '32px', height: '22px' }}>
                          <div style={{ position: 'absolute', left: 0, width: '15px', height: '22px', borderRadius: '3px', background: '#DC2626', border: '1px solid #FFF', transform: 'rotate(-10deg)' }} />
                          <div style={{ position: 'absolute', left: '7px', width: '15px', height: '22px', borderRadius: '3px', background: '#2563EB', border: '1px solid #FFF', transform: 'rotate(0deg)' }} />
                          <div style={{ position: 'absolute', left: '14px', width: '15px', height: '22px', borderRadius: '3px', background: '#16A34A', border: '1px solid #FFF', transform: 'rotate(10deg)' }} />
                        </div>
                        <span style={{ marginLeft: '6px', fontSize: '0.82rem', fontWeight: 900, color: '#FEF08A' }}>
                          {p.cardCount}
                        </span>
                      </div>

                      {/* Uno Status / Catch Button */}
                      {p.cardCount === 1 && (
                        <div style={{ marginTop: '4px' }}>
                          {p.saidUno ? (
                            <div style={{ background: '#DC2626', color: '#FFF', fontSize: '0.68rem', fontWeight: 900, padding: '0.15rem 0.5rem', borderRadius: '8px', border: '1px solid #FCA5A5', boxShadow: '0 0 10px rgba(220, 38, 38, 0.7)' }}>
                              🔥 SAID UNO!
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCatchPlayerUno(p.id)}
                              style={{
                                fontSize: '0.68rem',
                                background: '#DC2626',
                                color: '#FFF',
                                border: '1.5px solid #FCD34D',
                                borderRadius: '8px',
                                padding: '0.2rem 0.55rem',
                                cursor: 'pointer',
                                fontWeight: 900,
                                boxShadow: '0 0 12px rgba(220, 38, 38, 0.8)'
                              }}
                            >
                              🚨 CATCH UNO!
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* CENTER OF THE TABLE: DRAW PILE + THROWN DISCARD PILE */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 6,
                    pointerEvents: 'auto'
                  }}
                >
                  {/* Direction Badge */}
                  <div
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: 'rgba(15, 23, 42, 0.85)',
                      color: '#FEF08A',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      marginBottom: '0.65rem',
                      border: '1px solid rgba(254, 240, 138, 0.3)',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      backdropFilter: 'blur(4px)'
                    }}
                  >
                    <span style={{ fontSize: '0.95rem', display: 'inline-block', transform: direction === 1 ? 'none' : 'scaleX(-1)' }}>
                      ↻
                    </span>
                    <span>{direction === 1 ? 'Clockwise' : 'Counter-Clockwise'}</span>
                  </div>

                  {/* Draw Pile + Discard Pile Side by Side */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', position: 'relative' }}>
                    {/* Active Stack Warning Banner */}
                    {pendingDrawCount > 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '-32px',
                          background: 'linear-gradient(135deg, #DC2626, #991B1B)',
                          color: '#FFF',
                          padding: '0.25rem 0.85rem',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '0.78rem',
                          fontWeight: 900,
                          letterSpacing: '0.05em',
                          border: '2px solid #FCD34D',
                          boxShadow: '0 0 16px rgba(220, 38, 38, 0.9)',
                          whiteSpace: 'nowrap',
                          zIndex: 12,
                          animation: 'pulse 1.2s infinite ease-in-out'
                        }}
                      >
                        💥 ACTIVE STACK: +{pendingDrawCount} CARDS!
                      </div>
                    )}

                    {/* DRAW PILE */}
                    <div
                      onClick={isMyTurn && (pendingDrawCount > 0 || !hasDrawnThisTurn) ? handleDrawCard : undefined}
                      style={{
                        width: '88px',
                        height: '128px',
                        borderRadius: '12px',
                        background: pendingDrawCount > 0
                          ? 'linear-gradient(135deg, #7F1D1D, #450A0A)'
                          : 'linear-gradient(135deg, #1E293B, #0F172A)',
                        border: isMyTurn
                          ? (pendingDrawCount > 0 ? '3px solid #EF4444' : (!hasDrawnThisTurn ? '3px solid #FCD34D' : '3px solid #475569'))
                          : '3px solid #475569',
                        boxShadow: isMyTurn
                          ? (pendingDrawCount > 0
                            ? '0 0 20px rgba(239, 68, 68, 0.9), 3px 3px 0 #450A0A'
                            : (!hasDrawnThisTurn ? '0 0 18px rgba(245, 158, 11, 0.8), 3px 3px 0 #0F172A' : '3px 3px 0 #0F172A'))
                          : '3px 3px 0 #0F172A, 6px 6px 0 #334155, 0 8px 18px rgba(0,0,0,0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isMyTurn && (pendingDrawCount > 0 || !hasDrawnThisTurn) ? 'pointer' : 'not-allowed',
                        color: '#FFF',
                        userSelect: 'none',
                        transform: isMyTurn && (pendingDrawCount > 0 || !hasDrawnThisTurn) ? 'scale(1.04)' : 'none',
                        transition: 'all 0.15s ease',
                        position: 'relative',
                        opacity: isMyTurn && pendingDrawCount === 0 && hasDrawnThisTurn ? 0.8 : 1
                      }}
                      title={
                        isMyTurn
                          ? (pendingDrawCount > 0
                            ? `Click to draw +${pendingDrawCount} penalty cards!`
                            : (hasDrawnThisTurn ? 'Already drawn 1 card this turn. Throw a card or pass.' : 'Click to draw 1 card'))
                          : ''
                      }
                    >
                      <Layers size={26} color={isMyTurn && (pendingDrawCount > 0 || !hasDrawnThisTurn) ? '#FCD34D' : '#94A3B8'} />
                      <span style={{ fontWeight: 900, fontSize: '0.8rem', marginTop: '0.25rem', letterSpacing: '1px' }}>
                        {pendingDrawCount > 0 ? `+${pendingDrawCount}` : 'DRAW'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: '2px' }}>
                        🂠 {drawPileCount}
                      </span>
                      {isMyTurn && pendingDrawCount > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '-22px',
                            background: '#DC2626',
                            color: '#FFF',
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            padding: '0.12rem 0.5rem',
                            borderRadius: '10px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                            border: '1px solid #FCA5A5'
                          }}
                        >
                          DRAW +{pendingDrawCount} 💥
                        </span>
                      )}
                      {isMyTurn && pendingDrawCount === 0 && !hasDrawnThisTurn && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '-20px',
                            background: '#F59E0B',
                            color: '#000',
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '10px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.4)'
                          }}
                        >
                          TAP TO DRAW (1 MAX)
                        </span>
                      )}
                      {isMyTurn && pendingDrawCount === 0 && hasDrawnThisTurn && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: '-20px',
                            background: '#475569',
                            color: '#FEF08A',
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '10px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          DRAWN (1 MAX)
                        </span>
                      )}
                    </div>

                    {/* DISCARD PILE (The card thrown into the center of the circle!) */}
                    {topCard && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                        <div
                          style={{
                            width: '92px',
                            height: '132px',
                            borderRadius: '12px',
                            backgroundColor: COLOR_CONFIG[activeColor]?.hex || '#1E293B',
                            border: '3.5px solid #FFF',
                            boxShadow: `0 0 24px ${COLOR_CONFIG[activeColor]?.hex || 'rgba(0,0,0,0.4)'}, 0 8px 18px rgba(0,0,0,0.5)`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFF',
                            fontWeight: 900,
                            position: 'relative',
                            transform: 'rotate(-2deg)'
                          }}
                        >
                          <span style={{ position: 'absolute', top: '5px', left: '7px', fontSize: '0.85rem' }}>
                            {topCard.label}
                          </span>
                          <span style={{ fontSize: '2.4rem' }}>{topCard.label}</span>
                          <span style={{ position: 'absolute', bottom: '5px', right: '7px', fontSize: '0.85rem' }}>
                            {topCard.label}
                          </span>
                        </div>

                        {/* Active Color Pill */}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '-22px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: COLOR_CONFIG[activeColor]?.bg || '#FEF2F2',
                            color: COLOR_CONFIG[activeColor]?.hex || '#DC2626',
                            padding: '0.15rem 0.55rem',
                            borderRadius: 'var(--radius-pill)',
                            fontSize: '0.7rem',
                            fontWeight: 900,
                            border: `1.5px solid ${COLOR_CONFIG[activeColor]?.border || '#FCA5A5'}`,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                          }}
                        >
                          <span>Active: {COLOR_CONFIG[activeColor]?.name || activeColor}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* YOU - BOTTOM SEAT ON THE TABLE */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                >
                  <div
                    style={{
                      padding: '0.35rem 0.9rem',
                      background: isMyTurn ? 'linear-gradient(135deg, #DC2626, #B91C1C)' : 'rgba(15, 23, 42, 0.92)',
                      border: isMyTurn ? '2.5px solid #FCD34D' : '2px solid rgba(255,255,255,0.3)',
                      borderRadius: 'var(--radius-pill)',
                      color: '#FFF',
                      boxShadow: isMyTurn ? '0 0 18px rgba(245, 158, 11, 0.85)' : '0 4px 10px rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: 800,
                      fontSize: '0.84rem'
                    }}
                  >
                    <span>{isHost ? '👑' : '👤'}</span>
                    <span>{playerName} (You)</span>
                    <span style={{ background: 'rgba(0,0,0,0.3)', padding: '0.12rem 0.45rem', borderRadius: '10px', fontSize: '0.76rem', fontWeight: 900, color: '#FEF08A' }}>
                      🎴 {myHand.length}
                    </span>
                    {isMyTurn && (
                      <span style={{ background: '#FCD34D', color: '#000', fontSize: '0.68rem', fontWeight: 900, padding: '0.12rem 0.4rem', borderRadius: '6px' }}>
                        YOUR TURN!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS (Draw, Pass, Shout UNO) */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {isMyTurn && pendingDrawCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDrawCard}
                    className="btn btn-primary"
                    style={{
                      padding: '0.6rem 1.4rem',
                      fontWeight: 900,
                      backgroundColor: '#DC2626',
                      borderColor: '#EF4444',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      boxShadow: '0 0 16px rgba(220, 38, 38, 0.7)',
                      animation: 'pulse 1.5s infinite ease-in-out'
                    }}
                  >
                    <Layers size={16} />
                    <span>DRAW +{pendingDrawCount} CARDS 💥</span>
                  </button>
                )}

                {isMyTurn && pendingDrawCount === 0 && !hasDrawnThisTurn && (
                  <button
                    type="button"
                    onClick={handleDrawCard}
                    className="btn btn-secondary"
                    style={{ padding: '0.55rem 1.25rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <Layers size={16} />
                    <span>DRAW 1 CARD</span>
                  </button>
                )}

                {isMyTurn && pendingDrawCount === 0 && hasDrawnThisTurn && (
                  <button
                    type="button"
                    onClick={handlePassTurn}
                    className="btn btn-primary"
                    style={{
                      padding: '0.55rem 1.4rem',
                      fontWeight: 800,
                      backgroundColor: '#2563EB',
                      borderColor: '#2563EB',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 0 14px rgba(37, 99, 235, 0.45)'
                    }}
                  >
                    <span>PASS TURN ⏭️</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCallUno}
                  disabled={myHand.length > 2}
                  className="btn btn-primary"
                  style={{
                    padding: '0.55rem 1.4rem',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    backgroundColor: myHand.length <= 2 ? '#DC2626' : '#9CA3AF',
                    borderColor: myHand.length <= 2 ? '#DC2626' : '#9CA3AF',
                    boxShadow: myHand.length <= 2 ? '0 0 16px rgba(220, 38, 38, 0.65)' : 'none',
                    transform: myHand.length <= 2 ? 'scale(1.04)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📢 SHOUT "UNO!"
                </button>
              </div>

              {/* YOUR HAND TRAY (Click to throw onto the table) */}
              <div style={{ borderTop: '1.5px solid var(--accent-border)', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', padding: '0 0.5rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                    Your Hand ({myHand.length} cards)
                  </span>
                  <span style={{ fontSize: '0.76rem', color: isMyTurn ? (hasPlayableCard ? '#16A34A' : '#DC2626') : 'var(--text-muted)', fontWeight: 700 }}>
                    {!isMyTurn
                      ? 'Wait for your turn to play'
                      : pendingDrawCount > 0
                        ? (hasPlayableCard ? `🔥 Attack Stacked! Drop a matching plus card to pass the attack, or draw +${pendingDrawCount} cards!` : `💥 You have no matching plus card! You must draw +${pendingDrawCount} cards.`)
                        : !hasDrawnThisTurn
                          ? (hasPlayableCard ? '👉 Click a matching card to throw, or draw 1 card!' : '⚠️ No matching card! Draw 1 card from the deck.')
                          : (hasPlayableCard ? '👉 You drew 1 card! Throw a matching card or click PASS TURN.' : '⚠️ No matching cards to throw! Click PASS TURN to end your turn.')}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.5rem 0.5rem 1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {myHand.map((card) => {
                    const playable = isMyTurn && canPlayCard(card, topCard, activeColor, pendingDrawCount);
                    const cardBg = card.color === 'WILD' ? '#1F2937' : COLOR_CONFIG[card.color]?.hex || '#333';
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleCardClick(card)}
                        disabled={!isMyTurn || !playable}
                        style={{
                          width: '70px',
                          height: '105px',
                          borderRadius: '10px',
                          backgroundColor: cardBg,
                          border: playable ? '3px solid #FCD34D' : '2px solid rgba(255,255,255,0.4)',
                          boxShadow: playable ? '0 0 14px rgba(245, 158, 11, 0.75), 0 4px 8px rgba(0,0,0,0.2)' : 'var(--shadow-sm)',
                          color: '#FFF',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          cursor: playable ? 'pointer' : 'not-allowed',
                          opacity: playable ? 1 : 0.65,
                          transform: playable ? 'translateY(-6px)' : 'none',
                          transition: 'all 0.15s ease',
                          padding: 0
                        }}
                        title={playable ? 'Click to throw this card into the table center!' : (!isMyTurn ? 'Not your turn' : 'Does not match color or number')}
                      >
                        <span style={{ fontSize: '0.72rem', alignSelf: 'flex-start', margin: '2px 0 0 6px' }}>{card.label}</span>
                        <span style={{ fontSize: '1.8rem', margin: 'auto 0' }}>{card.label}</span>
                        <span style={{ fontSize: '0.72rem', alignSelf: 'flex-end', margin: '0 6px 2px 0' }}>{card.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* In-Game Live Chat Box */}
              <div style={{ marginTop: '1.5rem', borderTop: '1.5px solid var(--accent-border)', paddingTop: '1.25rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '0.6rem' }}>
                  <MessageCircle size={16} color="#DC2626" />
                  <span>Live Match Chat</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>(Talk trash, laugh, or celebrate!)</span>
                </div>

                {/* Chat message stream */}
                <div
                  style={{
                    height: '140px',
                    overflowY: 'auto',
                    backgroundColor: 'var(--bg-canvas)',
                    border: '1.5px solid var(--accent-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                    marginBottom: '0.6rem'
                  }}
                >
                  {messages.length === 0 ? (
                    <div style={{ color: 'var(--text-light)', fontSize: '0.8rem', margin: 'auto 0' }}>
                      No messages yet. Say hi to other players!
                    </div>
                  ) : (
                    messages.map((m) => {
                      const isYou = m.senderId === myPlayerId;
                      const isAction = m.type === 'ACTION' || m.type === 'UNO' || m.type === 'SYSTEM';

                      if (isAction) {
                        return (
                          <div
                            key={m.id}
                            style={{
                              fontSize: '0.76rem',
                              color: m.type === 'UNO' ? '#DC2626' : 'var(--text-muted)',
                              fontStyle: 'italic',
                              padding: '0.15rem 0',
                              borderBottom: '1px dashed rgba(0,0,0,0.06)'
                            }}
                          >
                            {m.text}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isYou ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isYou ? '#DC2626' : 'var(--text-muted)', marginBottom: '1px' }}>
                            {isYou ? 'You' : m.sender || 'Player'}
                          </div>
                          <div
                            style={{
                              padding: '0.35rem 0.75rem',
                              borderRadius: '12px',
                              backgroundColor: isYou ? '#DC2626' : '#FFF',
                              color: isYou ? '#FFF' : 'var(--text-main)',
                              border: isYou ? 'none' : '1px solid var(--accent-border)',
                              fontSize: '0.85rem',
                              maxWidth: '80%',
                              wordBreak: 'break-word',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                            }}
                          >
                            {m.text}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Chat input form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatInput.trim()) return;
                    handleSendMessage(chatInput.trim());
                    setChatInput('');
                    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                  }}
                  style={{ display: 'flex', gap: '0.5rem' }}
                >
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Type a message to all players..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    maxLength={100}
                    style={{ fontSize: '0.85rem', padding: '0.55rem 0.85rem' }}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="btn btn-primary"
                    style={{ padding: '0.55rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                  >
                    <Send size={15} />
                    <span>Send</span>
                  </button>
                </form>
              </div>
              {/* Leave Room from Lobby */}
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="btn-subtle"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#DC2626', fontSize: '0.85rem' }}
                >
                  <LogOut size={15} />
                  <span>Leave Room</span>
                </button>
              </div>
            </div>
          )}

          {/* GAME FINISHED VIEW */}
          {gameState === 'FINISHED' && (
            <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#DC2626', marginBottom: '0.5rem' }}>
                {winner?.name} Won the Uno Match!
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                All cards were played cleanly! Great match!
              </p>

              {isHost ? (
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="btn btn-primary"
                  style={{ padding: '0.85rem 1.75rem', fontWeight: 800, backgroundColor: '#DC2626', borderColor: '#DC2626' }}
                >
                  <RotateCcw size={18} />
                  <span>PLAY AGAIN</span>
                </button>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>Waiting for Host to start another match...</div>
              )}
              {/* Leave Room from Lobby */}
              <div style={{ marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="btn-subtle"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#DC2626', fontSize: '0.85rem' }}
                >
                  <LogOut size={15} />
                  <span>Leave Room</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WILD COLOR PICKER MODAL */}
      {pendingWildCard && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="panel" style={{ maxWidth: '360px', width: '100%', textAlign: 'center', padding: '1.75rem 1.25rem' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: '0.4rem' }}>Choose Wild Color</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Pick the color for the next player to match:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              {UNO_COLORS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => handleSelectWildColor(col)}
                  style={{
                    padding: '1.1rem 0.5rem',
                    backgroundColor: COLOR_CONFIG[col]?.hex,
                    color: '#FFF',
                    fontWeight: 900,
                    fontSize: '1.05rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  {COLOR_CONFIG[col]?.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Room Chat Drawer */}
      <CardChatDrawer
        messages={messages}
        currentUserId={myPlayerId}
        onSendMessage={handleSendMessage}
        roomCode={roomCode}
      />

      {/* Host Authorization Modal */}
      <HostPasscodeModal
        isOpen={showPassModal}
        onClose={() => setShowPassModal(false)}
        onSuccess={() => {
          setShowPassModal(false);
          executeCreateRoom();
        }}
      />
    </div>
  );
}
