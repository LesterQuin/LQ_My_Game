import { Peer } from 'peerjs';
import { comfortCards, shuffleCards } from '../data/comfortCards.js';
import { DRAW_WORDS, getRandomWordOptions, formatWordHint } from '../data/drawWords.js';

function levenshteinDistance(a, b) {
  const s1 = (a || '').toLowerCase().trim();
  const s2 = (b || '').toLowerCase().trim();
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const matrix = [];
  for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[s2.length][s1.length];
}

// Prefix to avoid collisions on public PeerJS cloud
const PEER_PREFIX = 'cc-room-v1-';

// Each game plays exactly 60 randomly chosen questions from the master bank
export const GAME_DECK_SIZE = 60;

// Robust ICE configuration including STUN and free TURN relays for cross-network connectivity
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay'
    }
  ]
};

export class RoomPeerManager {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomCode = null;
    this.playerId = null;
    this.playerName = null;
    this.connections = new Map(); // For host: Map<playerId, DataConnection>
    this.hostConnection = null; // For guest: DataConnection to host
    this.roomState = null;
    this.onStateChange = null;
    this.onError = null;
    this.onToast = null;
    this.onReaction = null;
    this.onDrawSegment = null;
    this.onClearCanvas = null;
    this.onUndoStroke = null;
    this._gameTimer = null;
    this._intermissionTimer = null;
    this._selectionTimer = null;
    this._revealedIndices = new Set();
  }

  /**
   * Generates a 6-character room code without confusing letters
   */
  static generateCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  /**
   * Host creates a room
   */
  async createRoom({
    name,
    maxPlayers = 6,
    gameType = 'CARDS',
    deckSize = 30,
    totalRounds = 5,
    roundDuration = 60,
    selectedCategory = 'ALL',
    onStateChange,
    onError,
    onToast,
    onReaction,
    onDrawSegment,
    onClearCanvas,
    onUndoStroke
  }) {
    this.destroy(); // Clean any previous connection/listeners
    // Give browser/socket stack 150ms to release any old WebSocket
    await new Promise((r) => setTimeout(r, 150));

    this.isHost = true;
    this.playerName = name;
    this.playerId = `host_${Math.random().toString(36).substring(2, 9)}`;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onToast = onToast;
    this.onReaction = onReaction;
    this.onDrawSegment = onDrawSegment;
    this.onClearCanvas = onClearCanvas;
    this.onUndoStroke = onUndoStroke;

    let attempts = 0;
    let created = false;

    while (!created && attempts < 5) {
      attempts++;
      const code = RoomPeerManager.generateCode();
      const peerId = `${PEER_PREFIX}${code.toLowerCase()}`;

      try {
        await this._initHostPeer(peerId, code, name, maxPlayers, {
          gameType,
          deckSize,
          totalRounds,
          roundDuration,
          selectedCategory
        });
        created = true;
        this.roomCode = code;
      } catch (err) {
        console.warn(`Host peer init attempt ${attempts} failed:`, err);
        if (this.peer) {
          try {
            this.peer.destroy();
          } catch (e) {}
          this.peer = null;
        }

        if (attempts >= 5) {
          const detail = err?.type ? ` (${err.type})` : err?.message ? ` (${err.message})` : '';
          throw new Error(`Failed to create a room${detail}. Please check your internet connection or try again.`);
        }

        // Wait 350ms before retrying to prevent rapid rate-limiting on PeerJS cloud
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    return {
      roomCode: this.roomCode,
      playerId: this.playerId,
      roomState: this.roomState
    };
  }

  _initHostPeer(peerId, code, hostName, maxPlayers, options = {}) {
    const {
      gameType = 'CARDS',
      deckSize = 30,
      totalRounds = 5,
      roundDuration = 60,
      selectedCategory = 'ALL'
    } = options;

    const validDeckSize = [15, 30, 60].includes(Number(deckSize)) ? Number(deckSize) : 30;
    const validRounds = [3, 5, 8, 10].includes(Number(totalRounds)) ? Number(totalRounds) : 5;
    const validDuration = [45, 60, 80].includes(Number(roundDuration)) ? Number(roundDuration) : 60;
    const validCategory = ['ALL', 'Animals', 'Fruits', 'Professions', 'Sports', 'Food', 'Objects', 'Nature', 'Characters', 'Actions', 'MLBB'].includes(selectedCategory)
      ? selectedCategory
      : 'ALL';

    return new Promise((resolve, reject) => {
      let isSettled = false;

      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          if (this.peer) {
            try { this.peer.destroy(); } catch (e) {}
            this.peer = null;
          }
          reject(new Error('Signaling server response timed out.'));
        }
      }, 12000);

      try {
        this.peer = new Peer(peerId, {
          debug: 1,
          secure: true,
          config: ICE_CONFIG
        });
      } catch (e) {
        clearTimeout(timeout);
        return reject(e);
      }

      this.peer.on('open', () => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeout);
        // Initialize authoritative host state
        this.roomState = {
          roomCode: code,
          gameType, // 'CARDS' or 'DRAW_AND_GUESS'
          maxPlayers: Math.min(8, Math.max(2, maxPlayers)),
          status: 'LOBBY',
          hostPlayerId: this.playerId,
          players: [
            {
              playerId: this.playerId,
              name: hostName,
              isHost: true,
              connected: true,
              score: 0,
              roundScore: 0,
              hasGuessed: false
            }
          ],
          // Comfort Cards state:
          deckSize: validDeckSize,
          deck: [],
          currentCardIndex: 0,
          currentPlayerIndex: 0,
          currentCard: null,
          totalCards: validDeckSize,
          cardsRemaining: validDeckSize,

          // Draw & Guess state:
          totalRounds: validRounds,
          currentRound: 1,
          currentDrawerIndex: 0,
          roundDuration: validDuration,
          timerRemaining: validDuration,
          selectedCategory: validCategory,
          currentWord: null,
          currentCategory: '',
          wordHint: '',
          wordLength: 0,
          wordChoices: [],
          guessedPlayerIds: [],
          strokes: [],
          messages: [],
          lastRevealedWord: ''
        };

        this._setupHostListeners();
        this._notifyState();
        resolve(this.roomState);
      });

      this.peer.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeout);
        if (this.peer) {
          try {
            this.peer.destroy();
          } catch (e) {}
          this.peer = null;
        }
        reject(err);
      });
    });
  }

  _setupHostListeners() {
    this.peer.on('connection', (conn) => {
      conn.on('data', (data) => {
        this._handleHostMessage(conn, data);
      });

      conn.on('close', () => {
        this._handlePlayerDisconnect(conn);
      });

      conn.on('error', () => {
        this._handlePlayerDisconnect(conn);
      });
    });
  }

  _handleHostMessage(conn, msg) {
    switch (msg.type) {
      case 'JOIN_REQUEST': {
        const { playerId, name } = msg;

        // Check room capacity
        if (this.roomState.players.length >= this.roomState.maxPlayers) {
          conn.send({ type: 'JOIN_REJECTED', reason: 'Room is full.' });
          conn.close();
          return;
        }

        if (this.roomState.status === 'FINISHED') {
          conn.send({ type: 'JOIN_REJECTED', reason: 'This game has already ended.' });
          conn.close();
          return;
        }

        // Check if reconnecting
        const existingIdx = this.roomState.players.findIndex((p) => p.playerId === playerId);
        if (existingIdx !== -1) {
          this.roomState.players[existingIdx].connected = true;
          this.roomState.players[existingIdx].name = name;
        } else {
          this.roomState.players.push({
            playerId,
            name,
            isHost: false,
            connected: true
          });
        }

        this.connections.set(playerId, conn);
        conn.send({ type: 'JOIN_ACCEPTED', roomState: this._sanitizeStateForPlayer(playerId) });
        this._broadcastState();
        if (this.onToast) this.onToast(`${name} joined the room.`);
        break;
      }

      case 'LEAVE_ROOM': {
        this._handlePlayerDisconnect(conn);
        break;
      }

      case 'REACTION': {
        this._broadcastReaction({
          id: `rx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          emoji: msg.emoji,
          senderName: msg.senderName || 'A friend',
          x: Math.floor(Math.random() * 60) + 20
        });
        break;
      }

      case 'SET_DECK_SIZE': {
        const size = [15, 30, 60].includes(Number(msg.deckSize)) ? Number(msg.deckSize) : 30;
        this.roomState.deckSize = size;
        this.roomState.totalCards = size;
        this.roomState.cardsRemaining = size;
        this._broadcastState();
        break;
      }

      case 'SET_GAME_TYPE': {
        this.roomState.gameType = msg.gameType;
        this._broadcastState();
        break;
      }

      case 'SET_ROUNDS': {
        this.roomState.totalRounds = [3, 5, 8, 10].includes(Number(msg.rounds)) ? Number(msg.rounds) : 5;
        this._broadcastState();
        break;
      }

      case 'SET_ROUND_DURATION': {
        this.roomState.roundDuration = [45, 60, 80].includes(Number(msg.duration)) ? Number(msg.duration) : 60;
        this.roomState.timerRemaining = this.roomState.roundDuration;
        this._broadcastState();
        break;
      }

      case 'SET_CATEGORY': {
        this.setCategory(msg.category);
        break;
      }

      case 'SELECT_WORD': {
        this.selectWord(msg.word);
        break;
      }

      case 'GIVE_HINT': {
        if (!this.roomState || this.roomState.status !== 'DRAWING') return;
        const currentDrawer = this.roomState.players[this.roomState.currentDrawerIndex];
        if (currentDrawer && currentDrawer.playerId === msg.playerId) {
          this._revealRandomLetter(true);
        }
        break;
      }

      case 'DRAW_SEGMENT': {
        if (!this.roomState || this.roomState.status !== 'DRAWING') return;
        this.roomState.strokes.push(msg.segment);
        // Relay to other connected peers
        for (const [pId, c] of this.connections.entries()) {
          if (c !== conn && c.open) {
            try {
              c.send({ type: 'DRAW_SEGMENT', segment: msg.segment });
            } catch (e) {}
          }
        }
        // If host is not drawer, draw it locally
        if (this.onDrawSegment) {
          this.onDrawSegment(msg.segment);
        }
        break;
      }

      case 'CLEAR_CANVAS': {
        if (!this.roomState) return;
        this.roomState.strokes = [];
        for (const [pId, c] of this.connections.entries()) {
          if (c !== conn && c.open) {
            try {
              c.send({ type: 'CLEAR_CANVAS' });
            } catch (e) {}
          }
        }
        if (this.onClearCanvas) {
          this.onClearCanvas();
        }
        break;
      }

      case 'UNDO_STROKE': {
        if (!this.roomState || !this.roomState.strokes.length) return;
        this.roomState.strokes.pop();
        for (const [pId, c] of this.connections.entries()) {
          if (c !== conn && c.open) {
            try {
              c.send({ type: 'UNDO_STROKE', strokes: this.roomState.strokes });
            } catch (e) {}
          }
        }
        if (this.onUndoStroke) {
          this.onUndoStroke(this.roomState.strokes);
        }
        break;
      }

      case 'SUBMIT_GUESS': {
        this.handleGuess(conn, msg.playerId, msg.guess);
        break;
      }

      default:
        break;
    }
  }

  _handlePlayerDisconnect(conn) {
    for (const [pId, c] of this.connections.entries()) {
      if (c === conn) {
        this.connections.delete(pId);
        const player = this.roomState.players.find((p) => p.playerId === pId);
        if (player) {
          player.connected = false;
          // In lobby, remove disconnected player completely to free up slot
          if (this.roomState.status === 'LOBBY') {
            this.roomState.players = this.roomState.players.filter((p) => p.playerId !== pId);
          }
          this._broadcastState();
          if (this.onToast) this.onToast(`${player.name} left the room.`);
        }
        break;
      }
    }
  }

  /**
   * Guest joins an existing room
   */
  async joinRoom({
    roomCode,
    name,
    playerId,
    onStateChange,
    onError,
    onToast,
    onReaction,
    onDrawSegment,
    onClearCanvas,
    onUndoStroke
  }) {
    this.destroy(); // Clean any previous connection/listeners
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase();
    this.playerName = name;
    this.playerId = playerId || `guest_${Math.random().toString(36).substring(2, 9)}`;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onToast = onToast;
    this.onReaction = onReaction;
    this.onDrawSegment = onDrawSegment;
    this.onClearCanvas = onClearCanvas;
    this.onUndoStroke = onUndoStroke;

    return new Promise((resolve, reject) => {
      let isSettled = false;

      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.destroy();
          reject(new Error('Connection timed out. Please check the room code and ensure the host is still in the room.'));
        }
      }, 25000);

      this.peer = new Peer({
        debug: 1,
        config: ICE_CONFIG
      });

      this.peer.on('open', () => {
        const hostPeerId = `${PEER_PREFIX}${this.roomCode.toLowerCase()}`;
        const conn = this.peer.connect(hostPeerId, { reliable: true });

        this.hostConnection = conn;

        // Monitor WebRTC connection failures
        const checkPeerConnection = () => {
          if (conn.peerConnection) {
            conn.peerConnection.addEventListener('iceconnectionstatechange', () => {
              const state = conn.peerConnection?.iceConnectionState;
              if (state === 'failed') {
                if (!isSettled) {
                  isSettled = true;
                  clearTimeout(timeout);
                  this.destroy();
                  reject(new Error('Network firewall blocked direct connection. Please ensure the host is online or try another network.'));
                }
              }
            });
          }
        };

        if (conn.peerConnection) {
          checkPeerConnection();
        } else {
          setTimeout(checkPeerConnection, 200);
        }

        conn.on('open', () => {
          conn.send({
            type: 'JOIN_REQUEST',
            playerId: this.playerId,
            name: this.playerName
          });
        });

        conn.on('data', (data) => {
          if (data.type === 'JOIN_ACCEPTED') {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeout);
              this.roomState = data.roomState;
              this._notifyState();
              resolve({
                roomCode: this.roomCode,
                playerId: this.playerId,
                roomState: this.roomState
              });
            }
          } else if (data.type === 'JOIN_REJECTED') {
            if (!isSettled) {
              isSettled = true;
              clearTimeout(timeout);
              this.destroy();
              reject(new Error(data.reason || 'Could not join room.'));
            }
          } else if (data.type === 'ROOM_STATE') {
            this.roomState = data.roomState;
            this._notifyState();
          } else if (data.type === 'REACTION') {
            if (this.onReaction && data.reaction) {
              this.onReaction(data.reaction);
            }
          } else if (data.type === 'DRAW_SEGMENT') {
            if (this.onDrawSegment && data.segment) {
              this.onDrawSegment(data.segment);
            }
          } else if (data.type === 'CLEAR_CANVAS') {
            if (this.onClearCanvas) {
              this.onClearCanvas();
            }
          } else if (data.type === 'UNDO_STROKE') {
            if (this.onUndoStroke) {
              this.onUndoStroke(data.strokes);
            }
          } else if (data.type === 'CLOSE_GUESS') {
            if (this.onToast) {
              this.onToast(`"${data.guess}" is very close!`, 'info');
            }
          }
        });

        conn.on('close', () => {
          if (this.onError) {
            this.onError('The host has disconnected or ended the room.');
          }
        });

        conn.on('error', (err) => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeout);
            this.destroy();
            reject(new Error('Failed to establish peer connection with host.'));
          }
        });
      });

      this.peer.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          this.destroy();
          if (err.type === 'peer-unavailable') {
            reject(new Error('Room not found. Please double-check the 6-character room code.'));
          } else {
            reject(new Error(`Connection failed (${err.type || err.message || 'network error'})`));
          }
        }
      });
    });
  }

  /**
   * Change deck size in lobby (HOST ONLY or forwarded from guest)
   */
  setDeckSize(deckSize) {
    const validSize = [15, 30, 60].includes(Number(deckSize)) ? Number(deckSize) : 30;
    if (this.isHost && this.roomState) {
      this.roomState.deckSize = validSize;
      this.roomState.totalCards = validSize;
      this.roomState.cardsRemaining = validSize;
      this._broadcastState();
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'SET_DECK_SIZE', deckSize: validSize });
    }
  }

  /**
   * Send floating reaction
   */
  sendReaction(emoji) {
    const rx = {
      id: `rx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      emoji,
      senderName: this.playerName || 'A friend',
      x: Math.floor(Math.random() * 60) + 20
    };

    if (this.isHost) {
      this._broadcastReaction(rx);
    } else if (this.hostConnection && this.hostConnection.open) {
      // Instant local display for responsiveness
      if (this.onReaction) this.onReaction(rx);
      this.hostConnection.send({
        type: 'REACTION',
        emoji,
        senderName: this.playerName
      });
    }
  }

  _broadcastReaction(rx) {
    if (this.onReaction) this.onReaction(rx);
    for (const conn of this.connections.values()) {
      try {
        if (conn.open) {
          conn.send({ type: 'REACTION', reaction: rx });
        }
      } catch (e) {}
    }
  }

  /**
   * Host starts the game
   */
  startGame() {
    if (!this.isHost || !this.roomState) return;

    if (this.roomState.players.length < 1) {
      throw new Error('Need at least 1 player to start the game.');
    }

    const targetDeckSize = this.roomState.deckSize || 30;
    const gameDeck = shuffleCards(comfortCards).slice(0, targetDeckSize);
    this.roomState.deck = gameDeck;
    this.roomState.currentCardIndex = 0;
    this.roomState.currentPlayerIndex = 0;
    this.roomState.currentCard = gameDeck[0];
    this.roomState.cardsRemaining = gameDeck.length;
    this.roomState.totalCards = gameDeck.length;
    this.roomState.status = 'PLAYING';

    this._broadcastState();
  }

  /**
   * Advance to next question (HOST ONLY)
   */
  nextQuestion() {
    // Strictly enforce host-only question progression in game logic
    if (!this.isHost) {
      return;
    }

    if (!this.roomState || this.roomState.status !== 'PLAYING') return;

    const nextIndex = this.roomState.currentCardIndex + 1;

    if (nextIndex >= this.roomState.deck.length) {
      // Completed deck!
      this.roomState.status = 'FINISHED';
      this.roomState.currentCard = null;
      this.roomState.cardsRemaining = 0;
    } else {
      this.roomState.currentCardIndex = nextIndex;
      this.roomState.currentCard = this.roomState.deck[nextIndex];
      this.roomState.cardsRemaining = this.roomState.deck.length - nextIndex;
      // Advance turn to next connected player
      this.roomState.currentPlayerIndex =
        (this.roomState.currentPlayerIndex + 1) % this.roomState.players.length;
    }

    this._broadcastState();
  }

  /**
   * Play again with a fresh random deck of chosen size (HOST ONLY)
   */
  playAgain() {
    if (!this.isHost || !this.roomState) return;

    const targetDeckSize = this.roomState.deckSize || 30;
    const gameDeck = shuffleCards(comfortCards).slice(0, targetDeckSize);
    this.roomState.deck = gameDeck;
    this.roomState.currentCardIndex = 0;
    this.roomState.currentPlayerIndex = 0;
    this.roomState.currentCard = gameDeck[0];
    this.roomState.cardsRemaining = gameDeck.length;
    this.roomState.totalCards = gameDeck.length;
    this.roomState.status = 'PLAYING';

    this._broadcastState();
  }

  /**
   * Set Game Mode (CARDS vs DRAW_AND_GUESS)
   */
  setGameType(gameType) {
    if (this.isHost && this.roomState) {
      this.roomState.gameType = gameType;
      this._broadcastState();
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'SET_GAME_TYPE', gameType });
    }
  }

  /**
   * Set total rounds for Draw & Guess
   */
  setRounds(rounds) {
    const valid = [3, 5, 8, 10].includes(Number(rounds)) ? Number(rounds) : 5;
    if (this.isHost && this.roomState) {
      this.roomState.totalRounds = valid;
      this._broadcastState();
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'SET_ROUNDS', rounds: valid });
    }
  }

  /**
   * Set round timer duration (45, 60, 80 seconds)
   */
  setRoundDuration(duration) {
    const valid = [45, 60, 80].includes(Number(duration)) ? Number(duration) : 60;
    if (this.isHost && this.roomState) {
      this.roomState.roundDuration = valid;
      this.roomState.timerRemaining = valid;
      this._broadcastState();
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'SET_ROUND_DURATION', duration: valid });
    }
  }

  /**
   * Set word category for Draw & Guess ('ALL', 'Animals', 'Food', 'Objects', 'Nature', 'Characters', 'Actions')
   */
  setCategory(category) {
    const validCategories = ['ALL', 'Animals', 'Fruits', 'Professions', 'Sports', 'Food', 'Objects', 'Nature', 'Characters', 'Actions', 'MLBB'];
    const chosen = validCategories.includes(category) ? category : 'ALL';
    if (this.isHost && this.roomState) {
      this.roomState.selectedCategory = chosen;
      this._broadcastState();
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'SET_CATEGORY', category: chosen });
    }
  }

  /**
   * =========================================================================
   * Draw & Guess Authoritative Host Logic
   * =========================================================================
   */

  startDrawGame() {
    if (!this.isHost || !this.roomState) return;

    if (this.roomState.players.length < 2) {
      throw new Error('Need at least 2 players to play Draw & Guess.');
    }

    // Reset scores & rounds
    for (const p of this.roomState.players) {
      p.score = 0;
      p.roundScore = 0;
      p.hasGuessed = false;
    }

    this.roomState.currentRound = 1;
    this.roomState.currentDrawerIndex = 0;
    this._usedWords = [];
    this.roomState.strokes = [];
    this.roomState.messages = [
      { type: 'SYSTEM', text: '🎨 Game started! Round 1 begins.' }
    ];

    this._startTurnWordSelection();
  }

  _startTurnWordSelection() {
    clearInterval(this._gameTimer);
    clearTimeout(this._intermissionTimer);
    clearTimeout(this._selectionTimer);

    if (!this.roomState) return;
    const drawer = this.roomState.players[this.roomState.currentDrawerIndex];
    if (!drawer) return;

    // Reset turn states
    for (const p of this.roomState.players) {
      p.hasGuessed = false;
      p.roundScore = 0;
    }
    this.roomState.strokes = [];
    this.roomState.guessedPlayerIds = [];
    this.roomState.currentWord = null;
    this.roomState.wordHint = '';
    this.roomState.status = 'SELECTING_WORD';
    this._revealedIndices = new Set();

    // 3 random words for drawer matching selected category
    const options = getRandomWordOptions(
      3,
      this._usedWords || [],
      this.roomState.selectedCategory || 'ALL'
    );
    this.roomState.wordChoices = options;

    this._broadcastState();

    // Auto-select first word after 12s if drawer doesn't choose
    this._selectionTimer = setTimeout(() => {
      if (this.roomState && this.roomState.status === 'SELECTING_WORD') {
        this.selectWord(options[0]);
      }
    }, 12000);
  }

  selectWord(word) {
    if (!this.isHost) {
      if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({ type: 'SELECT_WORD', word });
      }
      return;
    }

    clearTimeout(this._selectionTimer);
    if (!this.roomState || this.roomState.status !== 'SELECTING_WORD') return;

    const drawer = this.roomState.players[this.roomState.currentDrawerIndex];
    const item = DRAW_WORDS.find((w) => w.word.toLowerCase() === word.toLowerCase());

    if (!this._usedWords) this._usedWords = [];
    this._usedWords.push(word.toLowerCase());

    this.roomState.currentWord = word;
    this.roomState.currentCategory = item ? item.category : 'General';
    this.roomState.wordLength = word.replace(/[^a-zA-Z]/g, '').length;
    this._revealedIndices = new Set();
    this.roomState.wordHint = formatWordHint(word, this._revealedIndices);
    this.roomState.timerRemaining = this.roomState.roundDuration || 60;
    this.roomState.status = 'DRAWING';
    this.roomState.strokes = [];

    this.roomState.messages.push({
      type: 'SYSTEM',
      text: `✏️ ${drawer?.name} is drawing now!`
    });

    this._broadcastState();

    // 1-second interval loop
    clearInterval(this._gameTimer);
    this._gameTimer = setInterval(() => {
      if (!this.roomState || this.roomState.status !== 'DRAWING') {
        clearInterval(this._gameTimer);
        return;
      }

      this.roomState.timerRemaining -= 1;

      // Automatic hints at 50% and 25% of round duration
      const totalSec = this.roomState.roundDuration || 60;
      const hint1Time = Math.floor(totalSec * 0.55);
      const hint2Time = Math.floor(totalSec * 0.28);

      if (this.roomState.timerRemaining === hint1Time) {
        this._revealRandomLetter(false);
      } else if (this.roomState.timerRemaining === hint2Time) {
        this._revealRandomLetter(false);
      }

      if (this.roomState.timerRemaining <= 0) {
        clearInterval(this._gameTimer);
        this._endTurn("Time's up!");
      } else {
        this._broadcastState();
      }
    }, 1000);
  }

  _revealRandomLetter(isManual = false) {
    if (!this.roomState || !this.roomState.currentWord) return;
    const word = this.roomState.currentWord;
    const unrevealed = [];

    for (let i = 0; i < word.length; i++) {
      if (word[i] !== ' ' && word[i] !== '-' && !this._revealedIndices.has(i)) {
        unrevealed.push(i);
      }
    }

    // Keep at least 1 or 2 letters hidden so the whole word isn't revealed
    const minHidden = word.length > 5 ? 2 : 1;
    if (unrevealed.length <= minHidden) {
      if (isManual && this.onToast) {
        this.onToast('Maximum hints reached for this word!', 'info');
      }
      return;
    }

    const randomIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    this._revealedIndices.add(randomIndex);
    this.roomState.wordHint = formatWordHint(word, this._revealedIndices);

    const drawer = this.roomState.players[this.roomState.currentDrawerIndex];
    const hintMsg = isManual
      ? `💡 ${drawer?.name} gave a hint: ${this.roomState.wordHint}`
      : `💡 Hint revealed: ${this.roomState.wordHint}`;

    this.roomState.messages.push({
      type: 'SYSTEM',
      text: hintMsg
    });

    if (this.onToast) {
      this.onToast(hintMsg, 'info');
    }

    this._broadcastState();
  }

  /**
   * Manual hint trigger by the Drawer
   */
  giveHint() {
    if (!this.isHost) {
      if (this.hostConnection && this.hostConnection.open) {
        this.hostConnection.send({ type: 'GIVE_HINT', playerId: this.playerId });
      }
      return;
    }

    if (!this.roomState || this.roomState.status !== 'DRAWING') return;
    this._revealRandomLetter(true);
  }

  _endTurn(reason = "Time's up!") {
    clearInterval(this._gameTimer);
    clearTimeout(this._intermissionTimer);
    clearTimeout(this._selectionTimer);

    if (!this.roomState) return;

    this.roomState.status = 'ROUND_REVEAL';
    this.roomState.lastRevealedWord = this.roomState.currentWord;

    this.roomState.messages.push({
      type: 'SYSTEM',
      text: `${reason} The secret word was "${this.roomState.currentWord}".`
    });

    this._broadcastState();

    // 4.5 second intermission then next drawer or next round
    this._intermissionTimer = setTimeout(() => {
      if (!this.roomState) return;

      const nextDrawerIndex = (this.roomState.currentDrawerIndex + 1) % this.roomState.players.length;

      // Completed full cycle across all players
      if (nextDrawerIndex === 0) {
        this.roomState.currentRound += 1;
        if (this.roomState.currentRound > this.roomState.totalRounds) {
          // Finished game!
          this.roomState.status = 'FINISHED';
          this.roomState.messages.push({
            type: 'SYSTEM',
            text: '🏆 Game Over! Check out the final leaderboard.'
          });
          this._broadcastState();
          return;
        }
      }

      this.roomState.currentDrawerIndex = nextDrawerIndex;
      this._startTurnWordSelection();
    }, 4500);
  }

  handleGuess(conn, playerId, rawGuess) {
    if (!this.roomState || this.roomState.status !== 'DRAWING') return;
    const player = this.roomState.players.find((p) => p.playerId === playerId);
    if (!player) return;

    const currentDrawer = this.roomState.players[this.roomState.currentDrawerIndex];
    if (currentDrawer && currentDrawer.playerId === playerId) return;
    if (player.hasGuessed) return;

    const cleanGuess = (rawGuess || '').trim();
    if (!cleanGuess) return;

    const targetWord = (this.roomState.currentWord || '').trim();

    if (cleanGuess.toLowerCase() === targetWord.toLowerCase()) {
      // Correct!
      player.hasGuessed = true;
      const guessRank = this.roomState.guessedPlayerIds.length + 1;

      // Clean, low-number rank-based scoring (1st gets 10, then reduced points for later guesses)
      const rankPoints = [10, 8, 6, 5, 4, 3, 2, 1];
      const points = rankPoints[guessRank - 1] || 1;

      player.score = (player.score || 0) + points;
      player.roundScore = points;
      this.roomState.guessedPlayerIds.push(playerId);

      // Award Drawer +2 points per correct guesser
      if (currentDrawer) {
        currentDrawer.score = (currentDrawer.score || 0) + 2;
      }

      this.roomState.messages.push({
        type: 'CORRECT_GUESS',
        senderName: player.name
      });

      this._broadcastState();

      // Check if all non-drawers have guessed
      const nonDrawers = this.roomState.players.filter(
        (p) => p.playerId !== currentDrawer?.playerId && p.connected
      );
      const allGuessed = nonDrawers.length > 0 && nonDrawers.every((p) => p.hasGuessed);

      if (allGuessed) {
        this._endTurn('All players guessed the word!');
      }
    } else {
      // Check for close guess
      const dist = levenshteinDistance(cleanGuess, targetWord);
      if (dist === 1 || (targetWord.length >= 6 && dist === 2)) {
        if (conn && conn.open) {
          try {
            conn.send({ type: 'CLOSE_GUESS', guess: cleanGuess });
          } catch (e) {}
        } else if (playerId === this.playerId) {
          if (this.onToast) this.onToast(`"${cleanGuess}" is very close!`, 'info');
        }
      }

      this.roomState.messages.push({
        type: 'GUESS',
        senderName: player.name,
        text: cleanGuess
      });

      if (this.roomState.messages.length > 50) {
        this.roomState.messages = this.roomState.messages.slice(-50);
      }

      this._broadcastState();
    }
  }

  sendDrawSegment(segment) {
    if (this.isHost) {
      if (!this.roomState || this.roomState.status !== 'DRAWING') return;
      this.roomState.strokes.push(segment);
      for (const conn of this.connections.values()) {
        if (conn.open) {
          try {
            conn.send({ type: 'DRAW_SEGMENT', segment });
          } catch (e) {}
        }
      }
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'DRAW_SEGMENT', segment });
    }
  }

  clearCanvas() {
    if (this.isHost) {
      if (!this.roomState) return;
      this.roomState.strokes = [];
      for (const conn of this.connections.values()) {
        if (conn.open) {
          try {
            conn.send({ type: 'CLEAR_CANVAS' });
          } catch (e) {}
        }
      }
      if (this.onClearCanvas) this.onClearCanvas();
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'CLEAR_CANVAS' });
    }
  }

  undoStroke() {
    if (this.isHost) {
      if (!this.roomState || !this.roomState.strokes.length) return;
      this.roomState.strokes.pop();
      for (const conn of this.connections.values()) {
        if (conn.open) {
          try {
            conn.send({ type: 'UNDO_STROKE', strokes: this.roomState.strokes });
          } catch (e) {}
        }
      }
      if (this.onUndoStroke) this.onUndoStroke(this.roomState.strokes);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({ type: 'UNDO_STROKE' });
    }
  }

  submitGuess(guess) {
    if (this.isHost) {
      this.handleGuess(null, this.playerId, guess);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send({
        type: 'SUBMIT_GUESS',
        playerId: this.playerId,
        guess
      });
    }
  }

  playAgainDrawGame() {
    this.startDrawGame();
  }

  /**
   * Anti-Cheat State Sanitizer (Hides secret word from guessers during active drawing)
   */
  _sanitizeStateForPlayer(playerId) {
    if (!this.roomState) return null;
    if (this.roomState.gameType !== 'DRAW_AND_GUESS') return this.roomState;

    const copy = { ...this.roomState };
    const currentDrawer = this.roomState.players[this.roomState.currentDrawerIndex];
    const isDrawer = currentDrawer && currentDrawer.playerId === playerId;
    const player = this.roomState.players.find((p) => p.playerId === playerId);
    const hasGuessed = player && player.hasGuessed;

    if (this.roomState.status === 'DRAWING' || this.roomState.status === 'SELECTING_WORD') {
      if (!isDrawer && !hasGuessed) {
        copy.currentWord = null;
      }
    }
    return copy;
  }

  /**
   * Broadcast state to all connected guest peers
   */
  _broadcastState() {
    if (!this.isHost) return;

    this._notifyState();

    for (const [playerId, conn] of this.connections.entries()) {
      try {
        if (conn.open) {
          conn.send({
            type: 'ROOM_STATE',
            roomState: this._sanitizeStateForPlayer(playerId)
          });
        }
      } catch (e) {
        // ignore write error
      }
    }
  }

  _notifyState() {
    if (this.onStateChange && this.roomState) {
      const sanitized = this._sanitizeStateForPlayer(this.playerId);
      this.onStateChange(sanitized ? { ...sanitized } : null);
    }
  }

  /**
   * Leave room and destroy connection
   */
  destroy() {
    clearInterval(this._gameTimer);
    clearTimeout(this._intermissionTimer);
    clearTimeout(this._selectionTimer);
    this._gameTimer = null;
    this._intermissionTimer = null;
    this._selectionTimer = null;

    if (this.hostConnection) {
      try {
        this.hostConnection.send({ type: 'LEAVE_ROOM' });
        this.hostConnection.close();
      } catch (e) {}
      this.hostConnection = null;
    }

    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch (e) {}
    }
    this.connections.clear();

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }

    this.onToast = null;
    this.onStateChange = null;
    this.onReaction = null;
    this.onError = null;
    this.onDrawSegment = null;
    this.onClearCanvas = null;
    this.onUndoStroke = null;
    this.roomState = null;
    this.isHost = false;
    this.roomCode = null;
    this.playerId = null;
    this.playerName = null;
    this._revealedIndices.clear();
  }
}

// Export singleton instance
export const peerManager = new RoomPeerManager();
