import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  RotateCcw,
  Bot,
  Users,
  Sparkles,
  Zap,
  Shield,
  Copy,
  Check,
  Share2,
  LogOut,
  Wifi,
  User,
  Clock
} from 'lucide-react';
import { TicTacPeerManager } from '../services/tictacPeerService.js';
import { isHostUnlocked, HostPasscodeModal } from '../components/PasswordGate.jsx';

// Winning combinations for a 3x3 board
const WINNING_COMBOS = [
  [0, 1, 2], // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6], // columns
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8], // diagonals
  [2, 4, 6]
];

/**
 * Checks if there's a winner or tie
 */
function checkWinner(board) {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { winner: 'TIE', line: null };
  }

  return null;
}

/**
 * Minimax Unbeatable AI Algorithm
 */
function minimax(board, depth, isMaximizing, aiSymbol, humanSymbol) {
  const result = checkWinner(board);
  if (result) {
    if (result.winner === aiSymbol) return 10 - depth;
    if (result.winner === humanSymbol) return depth - 10;
    if (result.winner === 'TIE') return 0;
  }

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiSymbol;
        const score = minimax(board, depth + 1, false, aiSymbol, humanSymbol);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanSymbol;
        const score = minimax(board, depth + 1, true, aiSymbol, humanSymbol);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

/**
 * Finds the optimal move for the AI
 */
function getBestAiMove(currentBoard, aiSymbol, humanSymbol, difficulty = 'impossible') {
  const board = [...currentBoard];
  const availableMoves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) availableMoves.push(i);
  }

  if (availableMoves.length === 0) return undefined;

  // Medium difficulty: 25% chance of making a casual random move
  if (difficulty === 'medium' && Math.random() < 0.25) {
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }

  // 1. Immediate Win: If AI can win this turn, take it!
  for (const i of availableMoves) {
    board[i] = aiSymbol;
    if (checkWinner(board)?.winner === aiSymbol) {
      return i;
    }
    board[i] = null;
  }

  // 2. Immediate Block: If human can win next turn, block it!
  for (const i of availableMoves) {
    board[i] = humanSymbol;
    if (checkWinner(board)?.winner === humanSymbol) {
      return i;
    }
    board[i] = null;
  }

  // 3. Take Center square if available (strategic advantage)
  if (board[4] === null) {
    return 4;
  }

  // 4. Minimax optimal move for remaining possibilities
  let bestScore = -Infinity;
  let move = availableMoves[0];

  for (const i of availableMoves) {
    board[i] = aiSymbol;
    const score = minimax(board, 0, false, aiSymbol, humanSymbol);
    board[i] = null;
    if (score > bestScore) {
      bestScore = score;
      move = i;
    }
  }

  return move;
}

export function TicTacToe() {
  const [searchParams] = useSearchParams();
  const initialRoom = searchParams.get('room') || '';

  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [mode, setMode] = useState(initialRoom ? 'online' : 'ai'); // 'ai' (1 vs Computer) | 'online' (2 Players)
  const [difficulty, setDifficulty] = useState('impossible'); // 'impossible' | 'medium'
  const [scores, setScores] = useState({ x: 0, o: 0, ties: 0 });
  const [isAiThinking, setIsAiThinking] = useState(false);

  // 5-Second Countdown & Turn Pop-up State
  const [countdown, setCountdown] = useState(null);
  const [showTurnAlert, setShowTurnAlert] = useState(false);

  // Player Names
  const [playerName, setPlayerName] = useState(
    () => sessionStorage.getItem('cc_player_name') || ''
  );

  // Online Multiplayer State
  const [onlineStatus, setOnlineStatus] = useState('idle'); // 'idle' | 'hosting' | 'joining' | 'connected'
  const [roomCode, setRoomCode] = useState(initialRoom);
  const [joinInputCode, setJoinInputCode] = useState(initialRoom);
  const [myRole, setMyRole] = useState('X'); // 'X' (Host) or 'O' (Guest)
  const [opponentName, setOpponentName] = useState('');
  const [onlineMessage, setOnlineMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);

  const peerManagerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const turnAlertTimeoutRef = useRef(null);
  const lastWinnerRef = useRef(null);

  const gameResult = checkWinner(board);

  // Active names for X (host) and O (guest)
  const hostName =
    mode === 'online'
      ? myRole === 'X'
        ? playerName.trim() || 'Player 1'
        : opponentName || 'Player 1'
      : playerName.trim() || 'Player 1';

  const guestName =
    mode === 'online'
      ? myRole === 'O'
        ? playerName.trim() || 'Player 2'
        : opponentName || 'Player 2'
      : 'Computer';

  const isMyTurnOnline =
    mode === 'online' &&
    onlineStatus === 'connected' &&
    ((myRole === 'X' && isXNext) || (myRole === 'O' && !isXNext));

  const isMyTurnAI = mode === 'ai' && isXNext && !isAiThinking;
  const isMyTurn = isMyTurnOnline || isMyTurnAI;

  // Initialize or cleanup PeerManager
  const getPeerManager = () => {
    if (!peerManagerRef.current) {
      const pm = new TicTacPeerManager();

      pm.onConnected = ({ role, opponentName }) => {
        setMyRole(role);
        setOpponentName(opponentName);
        setOnlineStatus('connected');
        setOnlineMessage(`Connected with ${opponentName}! You are (${role}).`);
      };

      pm.onMove = ({ index, symbol }) => {
        setBoard((prev) => {
          const next = [...prev];
          next[index] = symbol;
          return next;
        });
        setIsXNext(symbol === 'O');
      };

      pm.onRematch = (startingTurnX) => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        setBoard(Array(9).fill(null));
        setIsXNext(typeof startingTurnX === 'boolean' ? startingTurnX : true);
      };

      pm.onResetScores = () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        setScores({ x: 0, o: 0, ties: 0 });
        setBoard(Array(9).fill(null));
        setIsXNext(true);
      };

      pm.onOpponentDisconnect = () => {
        setOnlineStatus('hosting');
        setOnlineMessage(`${opponentName || 'Opponent'} left. Waiting for a player to join...`);
      };

      pm.onError = (msg) => {
        setOnlineMessage(msg);
      };

      pm.onStatusChange = (msg) => {
        setOnlineMessage(msg);
      };

      peerManagerRef.current = pm;
    }
    return peerManagerRef.current;
  };

  // Clean up Peer on unmount
  useEffect(() => {
    return () => {
      if (peerManagerRef.current) {
        peerManagerRef.current.destroy();
        peerManagerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      if (turnAlertTimeoutRef.current) {
        clearTimeout(turnAlertTimeoutRef.current);
      }
    };
  }, []);

  // Trigger confetti and update scores on win
  useEffect(() => {
    if (gameResult && gameResult.winner !== 'TIE') {
      lastWinnerRef.current = gameResult.winner; // 'X' or 'O'
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      setScores((prev) => ({
        ...prev,
        [gameResult.winner.toLowerCase()]: prev[gameResult.winner.toLowerCase()] + 1
      }));
    } else if (gameResult && gameResult.winner === 'TIE') {
      lastWinnerRef.current = 'TIE';
      setScores((prev) => ({
        ...prev,
        ties: prev.ties + 1
      }));
    }
  }, [gameResult?.winner]);

  // 5-Second Countdown Timer when round concludes
  useEffect(() => {
    if (gameResult) {
      setCountdown(5);
      setShowTurnAlert(false);

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            // Next round triggers automatically
            handleRestart();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    } else {
      setCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  }, [gameResult?.winner]);

  // Turn Pop-Up Alert Effect (triggers when it becomes my turn)
  useEffect(() => {
    if (isMyTurn && !gameResult && board.some((cell) => cell === null)) {
      setShowTurnAlert(true);

      if (turnAlertTimeoutRef.current) {
        clearTimeout(turnAlertTimeoutRef.current);
      }

      turnAlertTimeoutRef.current = setTimeout(() => {
        setShowTurnAlert(false);
      }, 2500);

      return () => {
        if (turnAlertTimeoutRef.current) {
          clearTimeout(turnAlertTimeoutRef.current);
        }
      };
    } else {
      setShowTurnAlert(false);
    }
  }, [isXNext, mode, onlineStatus, myRole, gameResult, isAiThinking]);

  // Handle cell click
  const handleCellClick = (index) => {
    if (board[index] || gameResult || isAiThinking) {
      return;
    }

    setShowTurnAlert(false);

    // In 1 vs Computer mode (Player is X, Computer is O)
    if (mode === 'ai') {
      if (!isXNext || isAiThinking) return;

      const nextBoard = [...board];
      nextBoard[index] = 'X';
      setBoard(nextBoard);

      // Check if human player won or tied with this move
      const outcome = checkWinner(nextBoard);
      if (outcome) {
        setIsXNext(false);
        return;
      }

      // Computer's turn: 2-second thinking delay before selecting move
      setIsXNext(false);
      setIsAiThinking(true);

      setTimeout(() => {
        const aiMove = getBestAiMove(nextBoard, 'O', 'X', difficulty);
        if (aiMove !== undefined && nextBoard[aiMove] === null) {
          setBoard((prev) => {
            const updated = [...prev];
            updated[aiMove] = 'O';
            return updated;
          });
        }
        setIsXNext(true);
        setIsAiThinking(false);
      }, 2000);

      return;
    }

    // In 2 Players Online mode, player can only click on their turn
    if (mode === 'online') {
      if (onlineStatus !== 'connected') return;
      if (!isMyTurnOnline) return;

      const symbol = myRole;
      const nextBoard = [...board];
      nextBoard[index] = symbol;
      setBoard(nextBoard);
      setIsXNext(symbol === 'O');

      const pm = getPeerManager();
      pm.sendMove(index, symbol);
    }
  };

  // Host Online Room (Player 1)
  const executeCreateOnlineRoom = async () => {
    const finalName = playerName.trim() || 'Player 1';
    const pm = getPeerManager();
    try {
      const code = await pm.createRoom(finalName);
      setRoomCode(code);
      setMyRole('X');
      setOnlineStatus('hosting');
      setOnlineMessage('Waiting for Player 2 to join...');
    } catch (err) {
      setOnlineMessage('Failed to create online room. Try again.');
    }
  };

  const handleCreateOnlineRoom = async () => {
    if (!isHostUnlocked()) {
      setShowPassModal(true);
      return;
    }
    await executeCreateOnlineRoom();
  };

  // Join Online Room (Player 2)
  const handleJoinOnlineRoom = async (targetCode) => {
    const codeToJoin = (targetCode || joinInputCode || '').trim();
    if (!codeToJoin) return;

    const finalName = playerName.trim() || 'Player 2';
    const pm = getPeerManager();
    try {
      setOnlineStatus('joining');
      setOnlineMessage('Connecting to Player 1...');
      const code = await pm.joinRoom(codeToJoin, finalName);
      setRoomCode(code);
      setMyRole('O');
    } catch (err) {
      setOnlineStatus('idle');
      setOnlineMessage('Failed to join room. Check the code and try again.');
    }
  };

  // Copy Room Code
  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Copy Shareable Link
  const handleCopyLink = () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#/tictactoe?room=${roomCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Reset current round (Winner of previous round starts first!)
  const handleRestart = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    setBoard(Array(9).fill(null));

    // Winner of previous round starts next round!
    // If 'O' won, O goes first (isXNext = false)
    // If 'X' won, X goes first (isXNext = true)
    // If 'TIE', X starts
    const nextStartIsX = lastWinnerRef.current === 'O' ? false : true;
    setIsXNext(nextStartIsX);

    // If Computer (O) won, let it make its opening move after 2 seconds
    if (mode === 'ai' && !nextStartIsX) {
      setIsAiThinking(true);
      setTimeout(() => {
        const openingMove = getBestAiMove(Array(9).fill(null), 'O', 'X', difficulty);
        if (openingMove !== undefined) {
          setBoard((prev) => {
            const updated = [...prev];
            updated[openingMove] = 'O';
            return updated;
          });
        }
        setIsXNext(true);
        setIsAiThinking(false);
      }, 2000);
    } else {
      setIsAiThinking(false);
    }

    if (mode === 'online' && onlineStatus === 'connected') {
      const pm = getPeerManager();
      pm.sendRematch(nextStartIsX);
    }
  };

  // Reset all scores
  const handleResetScores = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    setScores({ x: 0, o: 0, ties: 0 });
    handleRestart();

    if (mode === 'online' && onlineStatus === 'connected') {
      const pm = getPeerManager();
      pm.sendResetScores();
    }
  };

  // Leave online room
  const handleLeaveOnline = () => {
    if (peerManagerRef.current) {
      peerManagerRef.current.destroy();
      peerManagerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    setShowTurnAlert(false);
    setOnlineStatus('idle');
    setRoomCode('');
    setJoinInputCode('');
    setOpponentName('');
    setOnlineMessage('');
    handleRestart();
  };

  return (
    <div className="panel" style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
      {/* Top Navigation */}
      <div style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
        <Link
          to="/"
          className="btn-subtle"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Games Hub</span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <Sparkles size={24} color="#2A9D8F" />
        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: 0 }}>Tic-Tok-Too</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.25rem' }}>
        Classic 3x3 strategy. Challenge the smart computer or play online with a friend!
      </p>

      {/* Mode Selector (1 vs Computer or 2 Player) */}
      <div className="tictac-mode-pills">
        <button
          type="button"
          onClick={() => {
            setMode('ai');
            handleRestart();
          }}
          className={`tictac-mode-btn ${mode === 'ai' ? 'active' : ''}`}
        >
          <Bot size={16} />
          <span>1 vs Computer</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('online');
            handleRestart();
          }}
          className={`tictac-mode-btn ${mode === 'online' ? 'active' : ''}`}
        >
          <Users size={16} />
          <span>2 Players</span>
        </button>
      </div>

      {/* Mode 1: AI Settings & Player Name */}
      {mode === 'ai' && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="tictac-diff-toggle" style={{ marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>AI Smartness:</span>
            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => {
                  setDifficulty('impossible');
                  handleRestart();
                }}
                className={`tictac-diff-pill ${difficulty === 'impossible' ? 'active expert' : ''}`}
                title="Minimax AI: Never makes mistakes!"
              >
                <Zap size={13} />
                <span>Unbeatable AI</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDifficulty('medium');
                  handleRestart();
                }}
                className={`tictac-diff-pill ${difficulty === 'medium' ? 'active casual' : ''}`}
                title="Occasional slip-ups for a fun casual match"
              >
                <Shield size={13} />
                <span>Smart AI</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <User size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>Your Name:</span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => {
                setPlayerName(e.target.value);
                sessionStorage.setItem('cc_player_name', e.target.value);
              }}
              placeholder="e.g. Lester"
              maxLength={15}
              style={{
                width: '120px',
                padding: '0.25rem 0.6rem',
                fontSize: '0.82rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--accent-border)',
                textAlign: 'center'
              }}
            />
          </div>
        </div>
      )}

      {/* Mode 2: 2 Players Online (Host or Join with Name Input) */}
      {mode === 'online' && (
        <div className="tictac-online-setup">
          {onlineStatus === 'idle' && (
            <div>
              {/* Nickname Input for Player 1 or Player 2 */}
              <div style={{ marginBottom: '1.15rem', textAlign: 'left' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  {initialRoom ? 'Player 2: Enter Your Name' : 'Your Name / Nickname'}
                </label>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => {
                    setPlayerName(e.target.value);
                    sessionStorage.setItem('cc_player_name', e.target.value);
                  }}
                  placeholder={initialRoom ? 'e.g. Sarah' : 'e.g. Lester'}
                  maxLength={15}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--accent-border)',
                    fontSize: '0.95rem',
                    fontWeight: 600
                  }}
                />
              </div>

              {/* If Player 2 opened via link with room code */}
              {initialRoom ? (
                <div style={{ background: 'var(--bg-canvas)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1.5px solid #2A9D8F' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    Invited to Room:
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.75rem', fontWeight: 800, color: '#2A9D8F', letterSpacing: '0.15rem', marginBottom: '0.75rem' }}>
                    {initialRoom}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleJoinOnlineRoom(initialRoom)}
                    className="btn btn-primary btn-block"
                    style={{ padding: '0.75rem', fontSize: '0.95rem' }}
                  >
                    <span>Join Room as {playerName.trim() || 'Player 2'}</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Option A: Player 1 creates room */}
                  <div style={{ marginBottom: '1rem' }}>
                    <button
                      type="button"
                      onClick={handleCreateOnlineRoom}
                      className="btn btn-primary btn-block"
                      style={{ padding: '0.75rem', fontSize: '0.95rem', gap: '0.5rem' }}
                    >
                      <Wifi size={18} />
                      <span>Create Room (Player 1)</span>
                    </button>
                  </div>

                  {/* Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.75rem 0' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--accent-border)' }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>OR JOIN AS PLAYER 2</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--accent-border)' }} />
                  </div>

                  {/* Option B: Player 2 enters code */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleJoinOnlineRoom(joinInputCode);
                    }}
                    className="tictac-join-form"
                  >
                    <input
                      type="text"
                      placeholder="Room Code"
                      value={joinInputCode}
                      onChange={(e) => setJoinInputCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        letterSpacing: '0.1rem',
                        textTransform: 'uppercase'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!joinInputCode.trim()}
                      className="btn btn-secondary"
                      style={{ padding: '0 1.25rem' }}
                    >
                      Join
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {onlineStatus === 'hosting' && (
            <div>
              <div className="tictac-conn-pill waiting">
                <span>Waiting for Player 2 to join...</span>
              </div>

              <div className="tictac-code-box">
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>ROOM CODE</span>
                <div className="tictac-code-text">{roomCode}</div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
                  Player 1 (Host): <strong style={{ color: '#D96B43' }}>{playerName.trim() || 'Player 1'} (X)</strong>
                </span>
              </div>

              <div className="tictac-actions-row">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}
                >
                  {copiedCode ? <Check size={15} color="#137333" /> : <Copy size={15} />}
                  <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="btn btn-primary"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}
                >
                  {copiedLink ? <Check size={15} color="#FFFFFF" /> : <Share2 size={15} />}
                  <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLeaveOnline}
                  className="btn btn-outline"
                  style={{ fontSize: '0.85rem', padding: '0.5rem 0.85rem' }}
                >
                  <LogOut size={15} />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {onlineStatus === 'joining' && (
            <div>
              <div className="tictac-conn-pill waiting">
                <span>Connecting to room {roomCode}...</span>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleLeaveOnline}
                  className="btn btn-outline"
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                >
                  <LogOut size={14} />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          )}

          {onlineStatus === 'connected' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div className="tictac-conn-pill connected" style={{ margin: 0 }}>
                <span>
                  🟢 <strong>{playerName.trim() || (myRole === 'X' ? 'Player 1' : 'Player 2')} ({myRole})</strong> vs{' '}
                  <strong>{opponentName || (myRole === 'X' ? 'Player 2' : 'Player 1')} ({myRole === 'X' ? 'O' : 'X'})</strong>
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="btn btn-outline"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                  title="Copy room link"
                >
                  {copiedLink ? <Check size={13} color="#137333" /> : <Share2 size={13} />}
                  <span>{copiedLink ? 'Copied' : 'Share'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLeaveOnline}
                  className="btn btn-outline"
                  style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                  title="Leave room"
                >
                  <LogOut size={13} />
                  <span>Leave</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Score Board with Real Player Names */}
      <div className="tictac-scoreboard">
        <div className={`score-card x-card ${isXNext && !gameResult ? 'turn' : ''}`}>
          <div className="score-label" title={hostName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {hostName} (X){mode === 'online' && myRole === 'X' ? ' • You' : ''}
          </div>
          <div className="score-val">{scores.x}</div>
        </div>

        <div className="score-card tie-card">
          <div className="score-label">Ties</div>
          <div className="score-val">{scores.ties}</div>
        </div>

        <div className={`score-card o-card ${!isXNext && !gameResult ? 'turn' : ''}`}>
          <div className="score-label" title={guestName} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {guestName} (O){mode === 'online' && myRole === 'O' ? ' • You' : ''}
          </div>
          <div className="score-val">{scores.o}</div>
        </div>
      </div>

      {/* 5-Second Countdown Banner When Round Finishes */}
      {countdown !== null && (
        <div className="tictac-countdown-banner">
          <div className="tictac-countdown-circle">
            <span>{countdown}</span>
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '0.94rem', color: '#92400E' }}>
              Next Round in {countdown}s...
            </div>
            <div style={{ fontSize: '0.78rem', color: '#B45309' }}>
              Scores are saved! Starting automatically.
            </div>
          </div>
          <button
            type="button"
            onClick={handleRestart}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            Play Now
          </button>
        </div>
      )}

      {/* Turn Status Banner with Player Names */}
      <div className="tictac-turn-banner">
        {gameResult ? (
          gameResult.winner === 'TIE' ? (
            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>🤝 It's a Draw!</span>
          ) : (
            <span style={{ color: gameResult.winner === 'X' ? '#D96B43' : '#2A9D8F', fontWeight: 800 }}>
              🎉 {gameResult.winner === 'X' ? hostName : guestName} Wins!{' '}
              {mode === 'online' && (gameResult.winner === myRole ? '(You won!)' : '')}
            </span>
          )
        ) : isAiThinking ? (
          <span style={{ color: '#2A9D8F', fontWeight: 600 }}>🤖 Computer is thinking...</span>
        ) : mode === 'online' && onlineStatus === 'connected' ? (
          isMyTurnOnline ? (
            <span style={{ color: myRole === 'X' ? '#D96B43' : '#2A9D8F', fontWeight: 700 }}>
              👉 Your Turn, <strong>{playerName.trim() || 'Player'}</strong>! Place ({myRole}).
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
              ⏳ Waiting for <strong>{opponentName || 'Opponent'}</strong> ({myRole === 'X' ? 'O' : 'X'})...
            </span>
          )
        ) : mode === 'online' && onlineStatus !== 'connected' ? (
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
            {onlineMessage || 'Waiting to connect...'}
          </span>
        ) : (
          <span>
            Current Turn:{' '}
            <strong style={{ color: isXNext ? '#D96B43' : '#2A9D8F' }}>
              {isXNext ? hostName : guestName} ({isXNext ? 'X' : 'O'})
            </strong>
          </span>
        )}
      </div>

      {/* Attention Pop-Up: It's Your Turn! */}
      {showTurnAlert && !gameResult && (
        <div className="tictac-turn-popup">
          <div className="tictac-turn-popup-content">
            <div className="tictac-turn-popup-icon">
              <Zap size={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.96rem', color: '#065F46' }}>
                It's Your Turn, {playerName.trim() || 'Player'}!
              </div>
              <div style={{ fontSize: '0.8rem', color: '#047857' }}>
                Tap any empty square to place your ({mode === 'online' ? myRole : 'X'})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Handcrafted Wooden Game Board Table Surface */}
      <div className="tictac-table-surface">
        {/* Subtle Table Center Watermark */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '5rem',
            fontWeight: 900,
            color: 'rgba(255,255,255,0.03)',
            letterSpacing: '8px',
            pointerEvents: 'none',
            userSelect: 'none'
          }}
        >
          #
        </div>

        {/* 3x3 Game Board Grid */}
        <div className="tictac-grid" style={{ width: '100%', maxWidth: '330px', position: 'relative', zIndex: 2 }}>
          {board.map((cell, index) => {
            const isWinningCell = gameResult?.line?.includes(index);
            const isDisabled =
              !!cell ||
              !!gameResult ||
              isAiThinking ||
              (mode === 'online' && (!isMyTurnOnline || onlineStatus !== 'connected'));

            return (
              <button
                key={index}
                type="button"
                onClick={() => handleCellClick(index)}
                disabled={isDisabled}
                className={`tictac-cell tictac-wood-cell ${cell ? cell.toLowerCase() : ''} ${isWinningCell ? 'winning' : ''}`}
                aria-label={`Cell ${index + 1}`}
              >
                {cell}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center', marginTop: '1.75rem' }}>
        <button
          type="button"
          onClick={handleRestart}
          disabled={mode === 'online' && onlineStatus !== 'connected'}
          className="btn btn-primary"
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.92rem' }}
        >
          <RotateCcw size={16} />
          <span>New Round</span>
        </button>

        <button
          type="button"
          onClick={handleResetScores}
          disabled={mode === 'online' && onlineStatus !== 'connected'}
          className="btn btn-outline"
          style={{ padding: '0.75rem 1.15rem', fontSize: '0.88rem' }}
        >
          <span>Reset Scores</span>
        </button>
      </div>

      {/* Host Authorization Passcode Modal */}
      <HostPasscodeModal
        isOpen={showPassModal}
        onClose={() => setShowPassModal(false)}
        onSuccess={() => {
          setShowPassModal(false);
          executeCreateOnlineRoom();
        }}
      />
    </div>
  );
}
