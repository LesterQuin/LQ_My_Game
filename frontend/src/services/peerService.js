import { Peer } from 'peerjs';
import { comfortCards, shuffleCards } from '../data/comfortCards.js';

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
  async createRoom({ name, maxPlayers = 6, deckSize = 30, onStateChange, onError, onToast, onReaction }) {
    this.destroy(); // Clean any previous connection/listeners
    this.isHost = true;
    this.playerName = name;
    this.playerId = `host_${Math.random().toString(36).substring(2, 9)}`;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onToast = onToast;
    this.onReaction = onReaction;

    let attempts = 0;
    let created = false;

    while (!created && attempts < 5) {
      attempts++;
      const code = RoomPeerManager.generateCode();
      const peerId = `${PEER_PREFIX}${code.toLowerCase()}`;

      try {
        await this._initHostPeer(peerId, code, name, maxPlayers, deckSize);
        created = true;
        this.roomCode = code;
      } catch (err) {
        if (attempts >= 5) {
          throw new Error('Failed to create a room. Please check your internet connection.');
        }
      }
    }

    return {
      roomCode: this.roomCode,
      playerId: this.playerId,
      roomState: this.roomState
    };
  }

  _initHostPeer(peerId, code, hostName, maxPlayers, deckSize = 30) {
    const validDeckSize = [15, 30, 60].includes(Number(deckSize)) ? Number(deckSize) : 30;

    return new Promise((resolve, reject) => {
      this.peer = new Peer(peerId, {
        debug: 1,
        config: ICE_CONFIG
      });

      this.peer.on('open', () => {
        // Initialize authoritative host state
        this.roomState = {
          roomCode: code,
          maxPlayers: Math.min(8, Math.max(2, maxPlayers)),
          deckSize: validDeckSize,
          status: 'LOBBY',
          hostPlayerId: this.playerId,
          players: [
            {
              playerId: this.playerId,
              name: hostName,
              isHost: true,
              connected: true
            }
          ],
          deck: [],
          currentCardIndex: 0,
          currentPlayerIndex: 0,
          currentCard: null,
          totalCards: validDeckSize,
          cardsRemaining: validDeckSize
        };

        this._setupHostListeners();
        this._notifyState();
        resolve(this.roomState);
      });

      this.peer.on('error', (err) => {
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
        conn.send({ type: 'JOIN_ACCEPTED', roomState: this.roomState });
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
  async joinRoom({ roomCode, name, playerId, onStateChange, onError, onToast, onReaction }) {
    this.destroy(); // Clean any previous connection/listeners
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase();
    this.playerName = name;
    this.playerId = playerId || `guest_${Math.random().toString(36).substring(2, 9)}`;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onToast = onToast;
    this.onReaction = onReaction;

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
   * Broadcast state to all connected guest peers
   */
  _broadcastState() {
    if (!this.isHost) return;

    this._notifyState();

    const payload = {
      type: 'ROOM_STATE',
      roomState: this.roomState
    };

    for (const conn of this.connections.values()) {
      try {
        if (conn.open) {
          conn.send(payload);
        }
      } catch (e) {
        // ignore write error
      }
    }
  }

  _notifyState() {
    if (this.onStateChange && this.roomState) {
      this.onStateChange({ ...this.roomState });
    }
  }

  /**
   * Leave room and destroy connection
   */
  destroy() {
    if (this.hostConnection) {
      try {
        this.hostConnection.send({ type: 'LEAVE_ROOM' });
        this.hostConnection.close();
      } catch (e) {}
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

    this.roomState = null;
  }
}

// Export singleton instance
export const peerManager = new RoomPeerManager();
