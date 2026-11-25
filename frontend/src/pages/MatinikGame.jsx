import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  Flame,
  ArrowLeft,
  Users,
  Trophy,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Crown
} from 'lucide-react';
import { getMatinikPeerManager } from '../services/matinikPeerService.js';
import { isHostUnlocked, HostPasscodeModal } from '../components/PasswordGate.jsx';
import { CardChatDrawer } from '../components/CardChatDrawer.jsx';

const OPERATORS = [
  { symbol: '+', label: 'Addition', icon: '➕' },
  { symbol: '-', label: 'Subtraction', icon: '➖' },
  { symbol: '×', label: 'Multiplication', icon: '✖️' }
];

function calculateEquation(terms, opSymbol) {
  if (!terms || terms.length === 0) return 0;
  if (terms.length === 1) return terms[0];

  if (opSymbol === '+') {
    return terms.reduce((acc, val) => acc + val, 0);
  }
  if (opSymbol === '×') {
    return terms.reduce((acc, val) => acc * val, 1);
  }
  if (opSymbol === '-') {
    return terms.slice(1).reduce((acc, val) => acc - val, terms[0]);
  }
  return 0;
}

export function MatinikGame() {
  const { initialRoom: routeRoom } = useParams();
  const [searchParams] = useSearchParams();
  const initialRoom = routeRoom || searchParams.get('room') || '';
  const navigate = useNavigate();

  // Room Configuration: Total Rounds (instead of target points)
  const [totalRounds, setTotalRounds] = useState(5); // Default 5 rounds
  const [maxPlayers, setMaxPlayers] = useState(6); // Default 6 players

  // Player Info - Always default placeholder 'Ace'
  const [playerName, setPlayerName] = useState(() => {
    return sessionStorage.getItem('cc_player_name') || localStorage.getItem('matinik_player_name') || '';
  });
  const [myPlayerId, setMyPlayerId] = useState('');
  const [players, setPlayers] = useState([]);

  // Online Peer State
  const [roomCode, setRoomCode] = useState(initialRoom || '');
  const [joinInputCode, setJoinInputCode] = useState(initialRoom || '');
  const [onlineStatus, setOnlineStatus] = useState('idle'); // 'idle' | 'creating' | 'joining' | 'connected'
  const [onlineMessage, setOnlineMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [isHost, setIsHost] = useState(!initialRoom);
  const peerManagerRef = useRef(null);

  // Chat State
  const [messages, setMessages] = useState([
    {
      id: 'system-init',
      type: 'SYSTEM',
      text: '👋 Welcome to Matinick si Les! Bilisan mag-isip at mag-type!',
      timestamp: Date.now()
    }
  ]);

  // Match State: 'LOBBY' | 'PICKING' | 'REVEALING' | 'SOLVING' | 'ROUND_END' | 'FINISHED'
  const [gameState, setGameState] = useState('LOBBY');
  const [roundNumber, setRoundNumber] = useState(1);
  const [scores, setScores] = useState({});
  const [currentOperator, setCurrentOperator] = useState(OPERATORS[0]);
  const [lockedPlayerIds, setLockedPlayerIds] = useState(new Set());

  // Round inputs & equation terms for all players
  const [myPickedNumber, setMyPickedNumber] = useState('');
  const [hasLockedIn, setHasLockedIn] = useState(false);
  const [equationTerms, setEquationTerms] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState(0);

  // Speed answer race state
  const [userAnswerInput, setUserAnswerInput] = useState('');
  const [roundWinner, setRoundWinner] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(null);

  // Stable authoritative refs on Host to avoid stale closures
  const solveStartTimeRef = useRef(0);
  const countdownIntervalRef = useRef(null);
  const autoNextTimerRef = useRef(null);
  const hostPickedNumbersRef = useRef({});
  const roundResolvedRef = useRef(false);
  const correctAnswerRef = useRef(0);
  const scoresRef = useRef({});
  const roundNumberRef = useRef(1);
  const totalRoundsRef = useRef(5);
  const gameStateRef = useRef('LOBBY');
  const playersRef = useRef([]);
  const currentOperatorRef = useRef(OPERATORS[0]);
  const equationTermsRef = useRef([]);
  const lockedPlayerIdsRef = useRef(new Set());

  // Keep refs in sync with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  useEffect(() => {
    roundNumberRef.current = roundNumber;
  }, [roundNumber]);

  useEffect(() => {
    totalRoundsRef.current = totalRounds;
  }, [totalRounds]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    currentOperatorRef.current = currentOperator;
  }, [currentOperator]);

  useEffect(() => {
    equationTermsRef.current = equationTerms;
  }, [equationTerms]);

  useEffect(() => {
    lockedPlayerIdsRef.current = lockedPlayerIds;
  }, [lockedPlayerIds]);

  // Synchronized countdown reveal helper
  const startCountdownAndSolve = useCallback((eqData) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    setEquationTerms(eqData.equationTerms || []);
    setCurrentOperator(eqData.operator);
    setCorrectAnswer(eqData.correctAnswer);
    correctAnswerRef.current = eqData.correctAnswer;
    setGameState('REVEALING');
    setCountdown(3);

    let count = 3;
    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setCountdown(null);
        setGameState('SOLVING');
        setUserAnswerInput('');
        setErrorMessage('');
        solveStartTimeRef.current = Date.now();
      } else {
        setCountdown(count);
      }
    }, 750);
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      clearInterval(countdownIntervalRef.current);
      clearTimeout(autoNextTimerRef.current);
      if (peerManagerRef.current) {
        peerManagerRef.current.destroy();
      }
    };
  }, []);

  // Peer Manager instance
  const getPeerManager = useCallback(() => {
    if (!peerManagerRef.current) {
      const pm = getMatinikPeerManager();

      // Host provides authoritative live game state to incoming players
      pm.getLiveGameState = () => {
        return {
          gameState: gameStateRef.current,
          roundNumber: roundNumberRef.current,
          totalRounds: totalRoundsRef.current,
          currentOperator: currentOperatorRef.current,
          equationTerms: equationTermsRef.current,
          correctAnswer: correctAnswerRef.current,
          scores: scoresRef.current,
          lockedPlayerIds: Array.from(lockedPlayerIdsRef.current)
        };
      };

      pm.onNewPlayerJoined = ({ id, name }) => {
        if (scoresRef.current[id] === undefined) {
          const updatedScores = {
            ...scoresRef.current,
            [id]: 0
          };
          scoresRef.current = updatedScores;
          setScores(updatedScores);
        }
      };

      pm.onConnected = ({ playerId, players: roomPlayers, maxPlayers: mp, totalRounds: tr, isHost: hostFlag, liveState }) => {
        setOnlineStatus('connected');
        setMyPlayerId(playerId);
        setPlayers(roomPlayers);
        setMaxPlayers(mp);
        setTotalRounds(tr);
        totalRoundsRef.current = tr;
        setIsHost(hostFlag);

        // Check if game was already started by Host: Auto-join directly!
        if (liveState && liveState.gameState && liveState.gameState !== 'LOBBY') {
          setGameState(liveState.gameState);
          gameStateRef.current = liveState.gameState;
          setRoundNumber(liveState.roundNumber || 1);
          roundNumberRef.current = liveState.roundNumber || 1;
          setCurrentOperator(liveState.currentOperator || OPERATORS[0]);
          currentOperatorRef.current = liveState.currentOperator || OPERATORS[0];
          setEquationTerms(liveState.equationTerms || []);
          equationTermsRef.current = liveState.equationTerms || [];
          setCorrectAnswer(liveState.correctAnswer || 0);
          correctAnswerRef.current = liveState.correctAnswer || 0;
          setScores(liveState.scores || {});
          scoresRef.current = liveState.scores || {};
          setLockedPlayerIds(new Set(liveState.lockedPlayerIds || []));
          lockedPlayerIdsRef.current = new Set(liveState.lockedPlayerIds || []);
          setOnlineMessage(`Joined ongoing match at Round ${liveState.roundNumber || 1}!`);
        } else {
          setGameState('LOBBY');
          gameStateRef.current = 'LOBBY';
          setOnlineMessage(`Connected to room ${pm.roomCode}!`);
        }
      };

      pm.onPlayersUpdate = (updatedPlayers) => {
        setPlayers([...updatedPlayers]);
      };

      pm.onStartRound = (payload) => {
        clearTimeout(autoNextTimerRef.current);
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        setRoundNumber(payload.roundNumber);
        roundNumberRef.current = payload.roundNumber;
        setCurrentOperator(payload.operator);
        setLockedPlayerIds(new Set());
        if (payload.scores) {
          setScores(payload.scores);
          scoresRef.current = payload.scores;
        }
        if (payload.totalRounds) {
          setTotalRounds(payload.totalRounds);
          totalRoundsRef.current = payload.totalRounds;
        }

        setMyPickedNumber('');
        setHasLockedIn(false);
        setUserAnswerInput('');
        setRoundWinner(null);
        setErrorMessage('');
        setGameState('PICKING');
      };

      pm.onPlayerLocked = ({ playerId }) => {
        setLockedPlayerIds((prev) => new Set([...prev, playerId]));
      };

      pm.onStartCountdown = (payload) => {
        startCountdownAndSolve(payload);
      };

      pm.onRoundResult = (payload) => {
        setRoundWinner(payload.winner);
        setScores(payload.scores);
        scoresRef.current = payload.scores;
        setCorrectAnswer(payload.correctAnswer);
        correctAnswerRef.current = payload.correctAnswer;
        setGameState(payload.isFinished ? 'FINISHED' : 'ROUND_END');

        try {
          confetti({ particleCount: 130, spread: 80, origin: { y: 0.55 } });
        } catch (e) {}
      };

      pm.onIncorrectAnswer = (msg) => {
        setErrorMessage(msg || 'Wrong answer! Try again.');
      };

      pm.onChatMessage = (msg) => {
        setMessages((prev) => [...prev, msg]);
      };

      pm.onPlayerDisconnect = (name) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            type: 'SYSTEM',
            text: `⚠️ ${name} disconnected.`,
            timestamp: Date.now()
          }
        ]);
      };

      pm.onError = (errText) => {
        setOnlineStatus('idle');
        setOnlineMessage(errText);
      };

      pm.onStatusChange = (statusText) => {
        setOnlineMessage(statusText);
      };

      peerManagerRef.current = pm;
    }
    return peerManagerRef.current;
  }, [startCountdownAndSolve]);

  // Host starts a new round
  const hostStartRound = useCallback((roundNum, currentScores) => {
    const pm = getPeerManager();
    const activePlayers = pm.players.length > 0 ? pm.players : playersRef.current;
    if (activePlayers.length < 2) return;

    roundResolvedRef.current = false;
    hostPickedNumbersRef.current = {};

    const randomOp = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];

    setRoundNumber(roundNum);
    roundNumberRef.current = roundNum;
    setCurrentOperator(randomOp);
    setLockedPlayerIds(new Set());
    setMyPickedNumber('');
    setHasLockedIn(false);
    setUserAnswerInput('');
    setRoundWinner(null);
    setErrorMessage('');
    setGameState('PICKING');

    pm.broadcastStartRound({
      roundNumber: roundNum,
      operator: randomOp,
      scores: currentScores,
      totalRounds: totalRoundsRef.current
    });
  }, [getPeerManager]);

  // Host checks if all players locked in and reveals equation
  const checkAllLockedInAndTriggerCountdown = useCallback(() => {
    const pm = getPeerManager();
    const activePlayers = pm.players.length > 0 ? pm.players : playersRef.current;

    const allLocked = activePlayers.every((p) => hostPickedNumbersRef.current[p.id] !== undefined);
    if (!allLocked) return;

    const op = currentOperatorRef.current || currentOperator;

    // Gather terms from all players in order
    let terms = activePlayers.map((p) => hostPickedNumbersRef.current[p.id]);

    // For subtraction, sort descending so the largest number is first (keeps result natural)
    if (op.symbol === '-') {
      terms = terms.slice().sort((a, b) => b - a);
    }

    const ans = calculateEquation(terms, op.symbol);
    correctAnswerRef.current = ans;
    equationTermsRef.current = terms;

    const countdownData = {
      equationTerms: terms,
      operator: op,
      correctAnswer: ans
    };

    pm.broadcastStartCountdown(countdownData);
    startCountdownAndSolve(countdownData);
  }, [currentOperator, getPeerManager, startCountdownAndSolve]);

  // Handle incoming messages on Host (numbers and answers from guests)
  useEffect(() => {
    const pm = getPeerManager();
    if (!isHost) return;

    pm.onOpponentSubmitNumber = (payload) => {
      hostPickedNumbersRef.current[payload.playerId] = parseInt(payload.number, 10);
      pm.broadcastPlayerLocked(payload.playerId, payload.playerName);
      setLockedPlayerIds((prev) => new Set([...prev, payload.playerId]));

      checkAllLockedInAndTriggerCountdown();
    };

    pm.onOpponentSubmitAnswer = (payload) => {
      if (gameStateRef.current !== 'SOLVING' || roundResolvedRef.current) return;

      const guess = parseInt(payload.answer, 10);
      if (guess === correctAnswerRef.current) {
        // FIRST TO ENTER THE CORRECT ANSWER GETS THE POINT!
        roundResolvedRef.current = true;
        const timeTaken = payload.timeTaken || ((Date.now() - solveStartTimeRef.current) / 1000).toFixed(2);
        const newScores = {
          ...scoresRef.current,
          [payload.playerId]: (scoresRef.current[payload.playerId] || 0) + 1
        };
        scoresRef.current = newScores;
        setScores(newScores);

        const isMatchOver = roundNumberRef.current >= totalRoundsRef.current;
        const winnerObj = {
          id: payload.playerId,
          name: payload.playerName,
          time: timeTaken
        };

        setRoundWinner(winnerObj);
        setGameState(isMatchOver ? 'FINISHED' : 'ROUND_END');

        pm.broadcastRoundResult({
          winner: winnerObj,
          scores: newScores,
          correctAnswer: correctAnswerRef.current,
          isFinished: isMatchOver
        });

        try {
          confetti({ particleCount: 130, spread: 80, origin: { y: 0.55 } });
        } catch (e) {}

        if (!isMatchOver) {
          clearTimeout(autoNextTimerRef.current);
          autoNextTimerRef.current = setTimeout(() => {
            const nextR = roundNumberRef.current + 1;
            hostStartRound(nextR, newScores);
          }, 3000);
        }
      } else {
        pm.sendToPlayer(payload.playerId, {
          type: 'INCORRECT_ANSWER',
          message: 'Wrong answer! Try again.'
        });
      }
    };
  }, [isHost, getPeerManager, hostStartRound, checkAllLockedInAndTriggerCountdown]);

  // Host clicks "START MATCH" from Lobby
  const handleHostStartMatch = () => {
    if (players.length < 2) {
      setErrorMessage('Need at least 2 players to start the match!');
      return;
    }
    const initialScores = {};
    players.forEach((p) => {
      initialScores[p.id] = 0;
    });
    setScores(initialScores);
    scoresRef.current = initialScores;
    hostStartRound(1, initialScores);
  };

  // Lock in secret number in Step 1 (ALL players do this!)
  const handleLockInNumber = (numberVal) => {
    const parsed = parseInt(numberVal, 10);
    if (!parsed || parsed <= 0) {
      setErrorMessage('Enter a positive number (no zero)!');
      return;
    }

    setHasLockedIn(true);
    setErrorMessage('');
    const pm = getPeerManager();

    if (isHost) {
      hostPickedNumbersRef.current[myPlayerId] = parsed;
      pm.broadcastPlayerLocked(myPlayerId, playerName || 'Host');
      setLockedPlayerIds((prev) => new Set([...prev, myPlayerId]));

      checkAllLockedInAndTriggerCountdown();
    } else {
      pm.sendNumberToHost(parsed);
      setLockedPlayerIds((prev) => new Set([...prev, myPlayerId]));
    }
  };

  // Submit answer in Step 3 (Speed Race) - First correct answer gets points!
  const handleUserSubmitAnswer = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean = userAnswerInput.trim();
    if (!clean) return;

    const guess = parseInt(clean, 10);
    if (isNaN(guess)) return;

    const pm = getPeerManager();
    const timeTaken = ((Date.now() - solveStartTimeRef.current) / 1000).toFixed(2);

    if (isHost) {
      if (roundResolvedRef.current) return;

      if (guess === correctAnswerRef.current) {
        // HOST IS THE FIRST TO SUBMIT CORRECT ANSWER!
        roundResolvedRef.current = true;
        const newScores = {
          ...scoresRef.current,
          [myPlayerId]: (scoresRef.current[myPlayerId] || 0) + 1
        };
        scoresRef.current = newScores;
        setScores(newScores);

        const isMatchOver = roundNumberRef.current >= totalRoundsRef.current;
        const winnerObj = {
          id: myPlayerId,
          name: playerName || 'Host',
          time: timeTaken
        };

        setRoundWinner(winnerObj);
        setGameState(isMatchOver ? 'FINISHED' : 'ROUND_END');

        pm.broadcastRoundResult({
          winner: winnerObj,
          scores: newScores,
          correctAnswer: correctAnswerRef.current,
          isFinished: isMatchOver
        });

        try {
          confetti({ particleCount: 130, spread: 80, origin: { y: 0.55 } });
        } catch (err) {}

        if (!isMatchOver) {
          clearTimeout(autoNextTimerRef.current);
          autoNextTimerRef.current = setTimeout(() => {
            const nextR = roundNumberRef.current + 1;
            hostStartRound(nextR, newScores);
          }, 3000);
        }
      } else {
        setErrorMessage('Wrong answer! Try again.');
      }
    } else {
      // Guest sends answer to Host for validation
      pm.sendAnswerToHost(guess, timeTaken);
    }
  };

  // Copy helpers
  const handleCopyInviteLink = () => {
    if (!roomCode) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}#/matinik/${roomCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Chat sender
  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    const pm = getPeerManager();
    const chatObj = pm.sendChatMessage(text.trim());
    setMessages((prev) => [...prev, chatObj]);
  };

  // Host creation execution
  const executeCreateOnlineRoom = async () => {
    const finalName = (playerName || '').trim() || 'Ace';
    sessionStorage.setItem('cc_player_name', finalName);
    localStorage.setItem('matinik_player_name', finalName);
    setPlayerName(finalName);

    setOnlineStatus('creating');
    const pm = getPeerManager();
    try {
      const res = await pm.createRoom({
        name: finalName,
        maxPlayers,
        totalRounds
      });
      setRoomCode(res.roomCode);
      setMyPlayerId(res.playerId);
      setPlayers(res.players);
      setIsHost(true);
      setOnlineStatus('connected');
      setGameState('LOBBY');
      navigate(`/matinik/${res.roomCode}`, { replace: true });
    } catch (err) {
      setOnlineStatus('idle');
      setOnlineMessage(err.message || 'Failed to create room.');
    }
  };

  const handleHostClick = () => {
    if (isHostUnlocked()) {
      executeCreateOnlineRoom();
    } else {
      setShowPassModal(true);
    }
  };

  const handleJoinClick = async (codeToJoin) => {
    const targetCode = (codeToJoin || joinInputCode || '').trim();
    if (!targetCode) {
      setOnlineMessage('Please enter a room code.');
      return;
    }
    const finalName = (playerName || '').trim() || 'Ace';
    sessionStorage.setItem('cc_player_name', finalName);
    localStorage.setItem('matinik_player_name', finalName);
    setPlayerName(finalName);

    setOnlineStatus('joining');
    const pm = getPeerManager();
    try {
      const res = await pm.joinRoom(targetCode, finalName);
      setRoomCode(res.roomCode);
      setMyPlayerId(res.playerId);
      setPlayers(res.players);
      setIsHost(false);
      setOnlineStatus('connected');

      // If game is in progress, jump directly into the live game
      if (res.liveState && res.liveState.gameState && res.liveState.gameState !== 'LOBBY') {
        setGameState(res.liveState.gameState);
        gameStateRef.current = res.liveState.gameState;
        setRoundNumber(res.liveState.roundNumber || 1);
        roundNumberRef.current = res.liveState.roundNumber || 1;
        setCurrentOperator(res.liveState.currentOperator || OPERATORS[0]);
        currentOperatorRef.current = res.liveState.currentOperator || OPERATORS[0];
        setEquationTerms(res.liveState.equationTerms || []);
        equationTermsRef.current = res.liveState.equationTerms || [];
        setCorrectAnswer(res.liveState.correctAnswer || 0);
        correctAnswerRef.current = res.liveState.correctAnswer || 0;
        setScores(res.liveState.scores || {});
        scoresRef.current = res.liveState.scores || {};
        setLockedPlayerIds(new Set(res.liveState.lockedPlayerIds || []));
        lockedPlayerIdsRef.current = new Set(res.liveState.lockedPlayerIds || []);
      } else {
        setGameState('LOBBY');
        gameStateRef.current = 'LOBBY';
      }
      navigate(`/matinik/${res.roomCode}`, { replace: true });
    } catch (err) {
      setOnlineStatus('idle');
      setOnlineMessage('Could not connect to room. Please check the code.');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="matinik-container">
      {/* Top Header Navigation */}
      <div className="matinik-top-nav">
        <Link to="/" className="btn-back-pill" title="Back to Games">
          <ArrowLeft size={16} />
          <span>Home</span>
        </Link>

        <div className="matinik-title-badge">
          <Flame size={18} color="#D96B43" />
          <span>Matinick si Les!</span>
        </div>

        <div
          className="online-tag-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(217, 107, 67, 0.1)',
            color: 'var(--accent-terracotta)',
            padding: '0.4rem 0.9rem',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.82rem',
            fontWeight: 700
          }}
        >
          <Users size={14} />
          <span>Multiplayer Online</span>
        </div>
      </div>

      {/* SETUP SCREEN (Before Connecting to a Room) */}
      {onlineStatus !== 'connected' && (
        <div className="panel" style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'left' }}>
          {onlineStatus === 'idle' && (
            <div>
              {/* Selected Game Header Banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '0.85rem 1rem',
                  background: 'rgba(217, 107, 67, 0.08)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.5rem',
                  border: '1px solid rgba(217, 107, 67, 0.2)'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(217, 107, 67, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-terracotta)'
                  }}
                >
                  <Flame size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    Matinick si Les!
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Multiplayer Math Duel & Speed Race
                  </div>
                </div>
              </div>

              {/* Your Nickname Input - Matches CreateGame & JoinGame */}
              <div className="input-group">
                <label htmlFor="player-name-input" className="input-label">
                  Your Nickname
                </label>
                <input
                  id="player-name-input"
                  type="text"
                  className="input-field"
                  placeholder="Ace"
                  value={playerName}
                  onChange={(e) => {
                    setPlayerName(e.target.value);
                    sessionStorage.setItem('cc_player_name', e.target.value);
                    localStorage.setItem('matinik_player_name', e.target.value);
                  }}
                  maxLength={20}
                  autoFocus
                />
              </div>

              {/* IF JOINING VIA LINK: Direct 1-Click Join */}
              {initialRoom ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                    <label className="input-label">Room Code</label>
                    <div
                      style={{
                        padding: '0.85rem',
                        background: 'rgba(217, 107, 67, 0.08)',
                        border: '1.5px dashed var(--accent-terracotta)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '1.5rem',
                        fontWeight: 900,
                        color: 'var(--accent-terracotta)',
                        letterSpacing: '2px',
                        textAlign: 'center'
                      }}
                    >
                      {initialRoom}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleJoinClick(initialRoom)}
                    className="btn btn-primary btn-block"
                    style={{ padding: '0.95rem', fontSize: '1.05rem', fontWeight: 800 }}
                  >
                    <span>JOIN DUEL ROOM</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/matinik')}
                    className="btn btn-subtle"
                    style={{ width: '100%', padding: '0.65rem', textAlign: 'center', justifyContent: 'center' }}
                  >
                    <span>Or Create New Room</span>
                  </button>
                </div>
              ) : (
                /* HOST OR JOIN BY CODE */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Host Configuration Box */}
                  <div
                    style={{
                      background: '#FFFDF9',
                      border: '1.5px solid var(--accent-border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.15rem'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        marginBottom: '1rem',
                        color: 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '0.95rem'
                      }}
                    >
                      <Crown size={16} color="#D97706" />
                      <span>Host a Multiplayer Duel</span>
                    </div>

                    {/* Total Rounds Selector (Changed from target score) */}
                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                      <label className="input-label" style={{ fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                        Total Rounds to Play
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                        {[3, 5, 8, 10].map((rounds) => (
                          <button
                            key={rounds}
                            type="button"
                            onClick={() => setTotalRounds(rounds)}
                            className={`btn ${totalRounds === rounds ? 'btn-primary' : 'btn-outline'}`}
                            style={{ padding: '0.5rem 0.2rem', fontSize: '0.8rem', fontWeight: 700 }}
                          >
                            {rounds} Rounds
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* How Many Players Can Join Selector */}
                    <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                      <label className="input-label" style={{ fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                        How Many Players Can Join
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                        {[2, 3, 4, 5, 6, 7, 8].map((num) => (
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
                      style={{ padding: '0.9rem', fontWeight: 800 }}
                    >
                      <span>CREATE ROOM AS HOST</span>
                    </button>
                  </div>

                  {/* Divider */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      color: 'var(--text-light)',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  >
                    <div style={{ flex: 1, height: '1px', background: 'var(--accent-border)' }} />
                    <span>OR JOIN EXISTING ROOM</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--accent-border)' }} />
                  </div>

                  {/* Join with Room Code */}
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="room-code-input" className="input-label">
                      Room Code
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        id="room-code-input"
                        type="text"
                        value={joinInputCode}
                        onChange={(e) => setJoinInputCode(e.target.value.toUpperCase())}
                        placeholder="ABC123"
                        maxLength={6}
                        className="input-field input-code"
                        style={{ flex: 1, textAlign: 'center', letterSpacing: '2px', fontWeight: 800 }}
                      />
                      <button
                        type="button"
                        onClick={() => handleJoinClick(joinInputCode)}
                        disabled={!joinInputCode.trim()}
                        className="btn btn-secondary"
                        style={{ padding: '0 1.5rem', fontWeight: 700 }}
                      >
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {onlineMessage && (
                <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#C84B31', fontWeight: 600, textAlign: 'center' }}>
                  {onlineMessage}
                </div>
              )}
            </div>
          )}

          {(onlineStatus === 'creating' || onlineStatus === 'joining') && (
            <div style={{ padding: '2rem 1rem', textAlign: 'center' }}>
              <div className="pulse-dot" style={{ width: '14px', height: '14px', margin: '0 auto 1rem' }} />
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                {onlineMessage || 'Connecting to online server...'}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Setting up WebRTC peer connection...
              </p>
            </div>
          )}
        </div>
      )}

      {/* ROOM CONNECTED: LOBBY OR ACTIVE GAME */}
      {onlineStatus === 'connected' && (
        <div className="matinik-arena-card">
          {/* LOBBY VIEW */}
          {gameState === 'LOBBY' && (
            <div className="matinik-lobby-wrap">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-terracotta)', fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                <Flame size={16} />
                <span>Room Lobby</span>
              </div>

              <h2 style={{ fontSize: '1.8rem', color: 'var(--text-main)', margin: '0 0 0.5rem' }}>
                Room Code: <span style={{ color: 'var(--accent-terracotta)', letterSpacing: '2px' }}>{roomCode}</span>
              </h2>

              {/* Room Code & Invite Link Copy Buttons */}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="btn btn-secondary"
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  <Copy size={14} />
                  <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="btn btn-secondary"
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 700 }}
                >
                  <Check size={14} />
                  <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
                </button>
              </div>

              {/* Room Meta Badges */}
              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 700 }}>
                <span className="diff-pill-btn active" style={{ pointerEvents: 'none', padding: '0.35rem 0.75rem' }}>
                  {totalRounds} Rounds Match
                </span>
                <span className="diff-pill-btn" style={{ pointerEvents: 'none', padding: '0.35rem 0.75rem', borderColor: 'var(--accent-border)' }}>
                  Players: {players.length} / {maxPlayers} Joined
                </span>
              </div>

              {/* Connected Player Slots Grid */}
              <div className="matinik-lobby-grid">
                {players.map((p) => {
                  const isYou = p.id === myPlayerId;
                  return (
                    <div key={p.id} className={`matinik-slot-card ${isYou ? 'is-you' : ''} ${p.isHost ? 'is-host' : ''}`}>
                      <div className="matinik-slot-avatar">{p.isHost ? '👑' : '👤'}</div>
                      <div className="matinik-slot-name" title={p.name}>
                        {p.name}
                      </div>
                      <div className={`matinik-slot-badge ${p.isHost ? 'host' : isYou ? 'you' : ''}`}>
                        {p.isHost ? 'Host' : isYou ? 'You' : 'Ready'}
                      </div>
                    </div>
                  );
                })}

                {/* Empty Slots */}
                {Array.from({ length: Math.max(0, maxPlayers - players.length) }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="matinik-empty-slot">
                    <span>Slot {players.length + idx + 1}</span>
                    <span style={{ fontSize: '0.68rem', marginTop: '0.2rem', opacity: 0.7 }}>Waiting...</span>
                  </div>
                ))}
              </div>

              {/* Start Game Action */}
              {isHost ? (
                <div>
                  <button
                    type="button"
                    onClick={handleHostStartMatch}
                    disabled={players.length < 2}
                    className="btn btn-primary"
                    style={{
                      padding: '0.9rem 2.5rem',
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      boxShadow: players.length >= 2 ? '0 6px 20px rgba(217, 107, 67, 0.28)' : 'none'
                    }}
                  >
                    <Flame size={18} />
                    <span>
                      {players.length >= 2
                        ? `START MATCH (${players.length}/${maxPlayers} PLAYERS)`
                        : `WAITING FOR PLAYERS (Need at least 2)`}
                    </span>
                  </button>
                  {players.length >= 2 && players.length < maxPlayers && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Tip: You can start now with {players.length} players, or wait for up to {maxPlayers}!
                    </div>
                  )}
                </div>
              ) : (
                <div className="online-waiting-pulse" style={{ justifyContent: 'center', fontSize: '0.92rem' }}>
                  <span className="pulse-dot" />
                  <span>Waiting for Host to start the match ({players.length}/${maxPlayers} ready)...</span>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE GAME PHASES */}
          {gameState !== 'LOBBY' && (
            <div>
              {/* Multiplayer Scoreboard Bar */}
              <div className="matinik-scoreboard-multi">
                <div className="matinik-multi-meta">
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-terracotta)' }}>
                    🎯 Round {roundNumber} of {totalRounds}
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {players.length} Players Competing
                  </div>
                </div>

                <div className="matinik-multi-chips-row">
                  {players.map((p) => {
                    const isYou = p.id === myPlayerId;
                    const isRoundWin = roundWinner && roundWinner.id === p.id;
                    const currentScore = scores[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className={`matinik-score-chip ${isYou ? 'is-you' : ''} ${isRoundWin ? 'is-winner' : ''}`}
                      >
                        <span>{p.isHost ? '👑 ' : ''}{p.name}{isYou ? ' (You)' : ''}</span>
                        <span className="matinik-score-chip-pts">{currentScore}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Operator Challenge Banner */}
              <div className="operator-banner">
                <span className="op-icon">{currentOperator.icon}</span>
                <span className="op-name">{currentOperator.label} Challenge</span>
                <span className="op-symbol">({currentOperator.symbol})</span>
              </div>

              {/* Phase 1: PICKING SECRET NUMBERS (ALL PLAYERS PARTICIPATE!) */}
              {gameState === 'PICKING' && (
                <div className="arena-picking-box">
                  <div className="matinik-pickers-notice">
                    <Sparkles size={16} />
                    <span>
                      Round {roundNumber}: Every player picks a number! All numbers combine into the formula!
                    </span>
                  </div>

                  <div className="picking-prompt-pill">
                    <span>Step 1: Enter your secret number (Any positive number, no 0)</span>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!hasLockedIn && myPickedNumber && parseInt(myPickedNumber, 10) > 0) {
                        handleLockInNumber(myPickedNumber);
                      }
                    }}
                    className="picking-number-input-wrap"
                  >
                    <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-light)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      YOUR SECRET NUMBER:
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoFocus
                      disabled={hasLockedIn}
                      value={myPickedNumber}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setMyPickedNumber(val);
                        if (errorMessage) setErrorMessage('');
                      }}
                      onWheel={(e) => e.target.blur()}
                      placeholder="e.g. 7"
                      className="matinik-picking-input"
                    />

                    {!hasLockedIn ? (
                      <button
                        type="submit"
                        disabled={!myPickedNumber || parseInt(myPickedNumber, 10) <= 0}
                        className="btn btn-primary btn-lock-in"
                        style={{ width: '100%', maxWidth: '280px', padding: '0.85rem 1.5rem', fontSize: '1rem', fontWeight: 800 }}
                      >
                        <Check size={18} />
                        <span>ENTER / LOCK IN</span>
                      </button>
                    ) : (
                      <div className="online-waiting-pulse" style={{ padding: '0.65rem 1rem', background: 'rgba(217, 107, 67, 0.08)', borderRadius: 'var(--radius-pill)', fontWeight: 700, color: 'var(--accent-terracotta)', width: '100%', maxWidth: '340px', justifyContent: 'center' }}>
                        <span className="pulse-dot" />
                        <span>Locked in ({myPickedNumber})! Waiting for other players...</span>
                      </div>
                    )}
                  </form>

                  {/* Status of All Players Locking In */}
                  <div style={{ marginTop: '1.25rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                      Player Lock-In Status ({lockedPlayerIds.size} / {players.length}):
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {players.map((p) => {
                        const isLocked = lockedPlayerIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            style={{
                              padding: '0.4rem 0.85rem',
                              borderRadius: 'var(--radius-pill)',
                              background: isLocked ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                              border: `1.5px solid ${isLocked ? '#10B981' : 'var(--accent-border)'}`,
                              color: isLocked ? '#10B981' : 'var(--text-muted)',
                              fontWeight: 700,
                              fontSize: '0.82rem'
                            }}
                          >
                            {p.name}: {isLocked ? '✓ Locked in!' : '⏳ Picking...'}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {errorMessage && (
                    <div className="matinik-error-note">{errorMessage}</div>
                  )}
                </div>
              )}

              {/* Phase 2: REVEALING COUNTDOWN */}
              {gameState === 'REVEALING' && (
                <div className="arena-countdown-box">
                  <div className="countdown-subtext">All numbers locked in! Get ready to solve...</div>
                  <div className="countdown-number-flash">{countdown}</div>
                </div>
              )}

              {/* Phase 3: SPEED SOLVING RACE (All Players Equation + Inline Answer) */}
              {gameState === 'SOLVING' && (
                <div className="arena-solving-box">
                  <form onSubmit={handleUserSubmitAnswer} className="equation-inline-form">
                    <div className="equation-stage inline" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                      {/* Formula chained across all players: e.g. 1 + 1 + 1 + 1 */}
                      {equationTerms.map((term, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && <span className="equation-operator">{currentOperator.symbol}</span>}
                          <span className="equation-term">{term}</span>
                        </React.Fragment>
                      ))}
                      <span className="equation-equals">=</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        placeholder="?"
                        value={userAnswerInput}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9-]/g, '');
                          setUserAnswerInput(val);
                          if (errorMessage) setErrorMessage('');
                        }}
                        onWheel={(e) => e.target.blur()}
                        className="equation-inline-input"
                      />
                      <button
                        type="submit"
                        disabled={!userAnswerInput.trim()}
                        className="btn btn-primary equation-inline-submit"
                        title="Submit answer (or press Enter)"
                      >
                        <Check size={20} />
                        <span>SUBMIT</span>
                      </button>
                    </div>
                  </form>

                  {errorMessage && (
                    <div className="matinik-error-note flash" style={{ marginTop: '0.85rem' }}>{errorMessage}</div>
                  )}
                </div>
              )}

              {/* Phase 4: ROUND_END RESULT */}
              {gameState === 'ROUND_END' && (
                <div className="arena-round-end-box">
                  <div className="round-result-icon">🎉</div>
                  <h3 className="round-result-title">
                    {roundWinner?.name} won Round {roundNumber}!
                  </h3>
                  <div className="round-result-equation" style={{ fontSize: '1.4rem' }}>
                    {equationTerms.join(` ${currentOperator.symbol} `)} = <strong>{correctAnswer}</strong>
                  </div>
                  {roundWinner?.time && (
                    <div className="round-result-time">
                      ⚡ Solved in {roundWinner.time} seconds!
                    </div>
                  )}
                  <div className="next-round-countdown">
                    {roundNumber < totalRounds
                      ? `Round ${roundNumber + 1} starting in 3 seconds...`
                      : 'Finalizing match results...'}
                  </div>
                </div>
              )}

              {/* Phase 5: FINISHED WINNER PODIUM */}
              {gameState === 'FINISHED' && (
                <div className="arena-gameover-box">
                  <Trophy size={56} color="#D96B43" className="trophy-bounce" />
                  <h2 style={{ fontSize: '2.2rem', color: 'var(--text-main)', margin: '0.75rem 0 0.25rem' }}>
                    {(() => {
                      const sorted = players.slice().sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
                      return sorted[0]?.name || 'Player';
                    })()} WINS!
                  </h2>
                  <div className="matinik-crown-tag">👑 Siya Ang Pinaka-Matinik!</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Final Results after {totalRounds} Rounds
                  </div>

                  {/* Leaderboard Table of Final Scores */}
                  <div style={{ maxWidth: '320px', margin: '1.25rem auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {players
                      .slice()
                      .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0))
                      .map((p, rank) => (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.55rem 0.95rem',
                            background: rank === 0 ? 'rgba(217, 107, 67, 0.1)' : '#FFFDF9',
                            border: `1.5px solid ${rank === 0 ? 'var(--accent-terracotta)' : 'var(--accent-border)'}`,
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: 700,
                            fontSize: '0.88rem'
                          }}
                        >
                          <span>{rank === 0 ? '🥇 ' : rank === 1 ? '🥈 ' : '🥉 '}{p.name}{p.id === myPlayerId ? ' (You)' : ''}</span>
                          <span style={{ color: 'var(--accent-terracotta)', fontWeight: 800 }}>{scores[p.id] || 0} pts</span>
                        </div>
                      ))}
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                    {isHost && (
                      <button
                        type="button"
                        onClick={() => {
                          setGameState('LOBBY');
                        }}
                        className="btn btn-primary"
                        style={{ padding: '0.85rem 2rem' }}
                      >
                        <RotateCcw size={16} />
                        <span>RETURN TO LOBBY</span>
                      </button>
                    )}
                    <Link
                      to="/"
                      className="btn btn-secondary"
                      style={{ padding: '0.85rem 1.75rem' }}
                    >
                      <span>Main Menu</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Host Password Gate Modal */}
      <HostPasscodeModal
        isOpen={showPassModal}
        onClose={() => setShowPassModal(false)}
        onSuccess={() => {
          setShowPassModal(false);
          executeCreateOnlineRoom();
        }}
      />

      {/* Floating Room Chat Drawer */}
      <CardChatDrawer
        messages={messages}
        currentUserId={myPlayerId || 'me'}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
}
