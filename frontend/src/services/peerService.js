import { Peer } from 'peerjs';
import { comfortCards, shuffleCards } from '../data/comfortCards.js';

// Prefix to avoid collisions on public PeerJS cloud
const PEER_PREFIX = 'cc-room-v1-';

// Robust ICE configuration including STUN and free TURN relays for cross-network connectivity
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
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
  async createRoom({ name, maxPlayers = 6, onStateChange, onError, onToast }) {
    this.destroy(); // Clean any previous connection/listeners
    this.isHost = true;
    this.playerName = name;
    this.playerId = `host_${Math.random().toString(36).substring(2, 9)}`;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onToast = onToast;

    let attempts = 0;
    let created = false;

    while (!created && attempts < 5) {
      attempts++;
      const code = RoomPeerManager.generateCode();
      const peerId = `${PEER_PREFIX}${code.toLowerCase()}`;

      try {
        await this._initHostPeer(peerId, code, name, maxPlayers);
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

  _initHostPeer(peerId, code, hostName, maxPlayers) {
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
          totalCards: comfortCards.length,
          cardsRemaining: comfortCards.length
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

      case 'NEXT_QUESTION': {
        this.nextQuestion();
        break;
      }

      case 'LEAVE_ROOM': {
        this._handlePlayerDisconnect(conn);
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
  async joinRoom({ roomCode, name, playerId, onStateChange, onError, onToast }) {
    this.destroy(); // Clean any previous connection/listeners
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase();
    this.playerName = name;
    this.playerId = playerId || `guest_${Math.random().toString(36).substring(2, 9)}`;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onToast = onToast;

    return new Promise((resolve, reject) => {
      let isSettled = false;

      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.destroy();
          reject(new Error('Connection timed out. Please check the room code and ensure the host is still in the room.'));
        }
      }, 15000);

      this.peer = new Peer({
        debug: 1,
        config: ICE_CONFIG
      });

      this.peer.on('open', () => {
        const hostPeerId = `${PEER_PREFIX}${this.roomCode.toLowerCase()}`;
        const conn = this.peer.connect(hostPeerId, { reliable: true });

        this.hostConnection = conn;

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
   * Host starts the game
   */
  startGame() {
    if (!this.isHost || !this.roomState) return;

    if (this.roomState.players.length < 1) {
      throw new Error('Need at least 1 player to start the game.');
    }

    const shuffled = shuffleCards(comfortCards);
    this.roomState.deck = shuffled;
    this.roomState.currentCardIndex = 0;
    this.roomState.currentPlayerIndex = 0;
    this.roomState.currentCard = shuffled[0];
    this.roomState.cardsRemaining = shuffled.length;
    this.roomState.totalCards = shuffled.length;
    this.roomState.status = 'PLAYING';

    this._broadcastState();
  }

  /**
   * Advance to next question (called by host or requested by active player)
   */
  nextQuestion() {
    if (!this.isHost) {
      if (this.hostConnection) {
        this.hostConnection.send({ type: 'NEXT_QUESTION' });
      }
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
   * Play again with reshuffled deck
   */
  playAgain() {
    if (!this.isHost || !this.roomState) return;

    const shuffled = shuffleCards(comfortCards);
    this.roomState.deck = shuffled;
    this.roomState.currentCardIndex = 0;
    this.roomState.currentPlayerIndex = 0;
    this.roomState.currentCard = shuffled[0];
    this.roomState.cardsRemaining = shuffled.length;
    this.roomState.totalCards = shuffled.length;
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
