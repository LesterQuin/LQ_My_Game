import { Peer } from 'peerjs';

const MATINIK_PEER_PREFIX = 'matinik-v1-';

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
    }
  ]
};

export class MatinikPeerManager {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomCode = null;
    this.playerId = null;
    this.playerName = 'Ace';
    this.maxPlayers = 6;
    this.totalRounds = 5;

    // Host tracks all guest connections: Map<peerId, { conn, playerId, playerName }>
    this.connections = new Map();
    // Guest tracks connection to host
    this.hostConn = null;

    // Player list: Array<{ id, name, isHost, score, connected }>
    this.players = [];

    // Callbacks
    this.onConnected = null;
    this.onPlayersUpdate = null;
    this.onNewPlayerJoined = null;
    this.getLiveGameState = null;
    this.onGameStart = null;
    this.onStartRound = null;
    this.onPlayerLocked = null;
    this.onStartCountdown = null;
    this.onRoundResult = null;
    this.onRematch = null;
    this.onChatMessage = null;
    this.onPlayerDisconnect = null;
    this.onError = null;
    this.onStatusChange = null;
    this.onIncorrectAnswer = null;
    this.onOpponentSubmitNumber = null;
    this.onOpponentSubmitAnswer = null;
  }

  static generateCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  static normalizeCode(code) {
    return (code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Host creates a new multiplayer online room
   */
  createRoom({ name = 'Ace', maxPlayers = 6, totalRounds = 5 }) {
    this.destroy();
    this.isHost = true;
    this.playerName = (name || '').trim() || 'Ace';
    this.maxPlayers = Math.min(8, Math.max(2, Number(maxPlayers) || 6));
    this.totalRounds = Number(totalRounds) || 5;
    this.playerId = `host_${Math.random().toString(36).substring(2, 9)}`;
    this.roomCode = MatinikPeerManager.generateCode();

    this.players = [
      {
        id: this.playerId,
        name: this.playerName,
        isHost: true,
        score: 0,
        connected: true
      }
    ];

    const peerId = `${MATINIK_PEER_PREFIX}${this.roomCode.toLowerCase()}`;

    if (this.onStatusChange) {
      this.onStatusChange('Creating online room...');
    }

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(peerId, {
          config: ICE_CONFIG,
          debug: 0
        });

        this.peer.on('open', () => {
          if (this.onStatusChange) {
            this.onStatusChange('Waiting for players to join...');
          }
          if (this.onPlayersUpdate) {
            this.onPlayersUpdate(this.players);
          }
          resolve({
            roomCode: this.roomCode,
            playerId: this.playerId,
            players: this.players
          });
        });

        this.peer.on('connection', (conn) => {
          this._handleIncomingHostConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('[MatinikPeer] Host Error:', err);
          if (err.type === 'unavailable-id') {
            this.createRoom({ name, maxPlayers, totalRounds }).then(resolve).catch(reject);
          } else {
            if (this.onError) this.onError(err.message || 'Connection error.');
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  _handleIncomingHostConnection(conn) {
    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return;

      switch (data.type) {
        case 'HANDSHAKE': {
          if (this.players.length >= this.maxPlayers) {
            conn.send({
              type: 'ROOM_FULL',
              message: `Room is full (Maximum ${this.maxPlayers} players).`
            });
            setTimeout(() => conn.close(), 600);
            return;
          }

          const guestId = data.playerId || `guest_${Math.random().toString(36).substring(2, 9)}`;
          const rawName = (data.name || '').trim() || 'Ace';
          
          let guestName = rawName;
          let counter = 2;
          while (this.players.some((p) => p.name.toLowerCase() === guestName.toLowerCase())) {
            guestName = `${rawName} (${counter++})`;
          }

          this.connections.set(conn.peer, {
            conn,
            playerId: guestId,
            playerName: guestName
          });

          this.players.push({
            id: guestId,
            name: guestName,
            isHost: false,
            score: 0,
            connected: true
          });

          // Fetch authoritative live state from Host if game is in progress
          const liveState = this.getLiveGameState ? this.getLiveGameState(guestId) : null;

          conn.send({
            type: 'HANDSHAKE_ACK',
            playerId: guestId,
            playerName: guestName,
            roomCode: this.roomCode,
            maxPlayers: this.maxPlayers,
            totalRounds: this.totalRounds,
            players: this.players,
            liveState
          });

          this.broadcast({
            type: 'ROOM_SYNC',
            players: this.players,
            maxPlayers: this.maxPlayers,
            totalRounds: this.totalRounds
          });

          if (this.onPlayersUpdate) {
            this.onPlayersUpdate(this.players);
          }
          if (this.onNewPlayerJoined) {
            this.onNewPlayerJoined({ id: guestId, name: guestName, liveState });
          }
          break;
        }

        case 'CHAT': {
          this.broadcast(data);
          if (this.onChatMessage) {
            this.onChatMessage(data);
          }
          break;
        }

        case 'SUBMIT_NUMBER': {
          if (this.onOpponentSubmitNumber) {
            this.onOpponentSubmitNumber(data);
          }
          break;
        }

        case 'SUBMIT_ANSWER': {
          if (this.onOpponentSubmitAnswer) {
            this.onOpponentSubmitAnswer(data);
          }
          break;
        }

        case 'REMATCH_VOTE': {
          if (this.onRematch) {
            this.onRematch();
          }
          break;
        }

        default:
          break;
      }
    });

    conn.on('close', () => {
      this._handleGuestDisconnect(conn.peer);
    });

    conn.on('error', () => {
      this._handleGuestDisconnect(conn.peer);
    });
  }

  _handleGuestDisconnect(peerId) {
    const entry = this.connections.get(peerId);
    if (!entry) return;

    this.connections.delete(peerId);
    this.players = this.players.filter((p) => p.id !== entry.playerId);

    this.broadcast({
      type: 'ROOM_SYNC',
      players: this.players,
      maxPlayers: this.maxPlayers,
      totalRounds: this.totalRounds
    });

    if (this.onPlayerDisconnect) {
      this.onPlayerDisconnect(entry.playerName);
    }
    if (this.onPlayersUpdate) {
      this.onPlayersUpdate(this.players);
    }
  }

  /**
   * Guest joins an online room by code
   */
  joinRoom(roomCode, playerName = 'Ace') {
    this.destroy();
    this.isHost = false;
    this.playerName = (playerName || '').trim() || 'Ace';
    this.playerId = `guest_${Math.random().toString(36).substring(2, 9)}`;
    const normalized = MatinikPeerManager.normalizeCode(roomCode);
    this.roomCode = normalized;
    const targetPeerId = `${MATINIK_PEER_PREFIX}${normalized.toLowerCase()}`;

    if (this.onStatusChange) {
      this.onStatusChange('Connecting to room...');
    }

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer({
          config: ICE_CONFIG,
          debug: 0
        });

        this.peer.on('open', () => {
          const conn = this.peer.connect(targetPeerId, { reliable: true });
          this.hostConn = conn;

          conn.on('open', () => {
            conn.send({
              type: 'HANDSHAKE',
              playerId: this.playerId,
              name: this.playerName
            });
          });

          conn.on('data', (data) => {
            if (!data || typeof data !== 'object') return;

            switch (data.type) {
              case 'HANDSHAKE_ACK': {
                this.playerId = data.playerId;
                this.playerName = data.playerName;
                this.players = data.players || [];
                this.maxPlayers = data.maxPlayers || 6;
                this.totalRounds = data.totalRounds || 5;

                if (this.onConnected) {
                  this.onConnected({
                    playerId: this.playerId,
                    players: this.players,
                    maxPlayers: this.maxPlayers,
                    totalRounds: this.totalRounds,
                    isHost: false,
                    liveState: data.liveState
                  });
                }
                if (this.onPlayersUpdate) {
                  this.onPlayersUpdate(this.players);
                }
                resolve({
                  roomCode: normalized,
                  playerId: this.playerId,
                  players: this.players,
                  liveState: data.liveState
                });
                break;
              }

              case 'ROOM_FULL': {
                if (this.onError) {
                  this.onError(data.message || 'Room is currently full.');
                }
                this.destroy();
                break;
              }

              case 'ROOM_SYNC': {
                this.players = data.players || [];
                this.maxPlayers = data.maxPlayers || this.maxPlayers;
                this.totalRounds = data.totalRounds || this.totalRounds;
                if (this.onPlayersUpdate) {
                  this.onPlayersUpdate(this.players);
                }
                break;
              }

              case 'GAME_START': {
                if (this.onGameStart) {
                  this.onGameStart(data);
                }
                break;
              }

              case 'START_ROUND': {
                if (this.onStartRound) {
                  this.onStartRound(data);
                }
                break;
              }

              case 'PLAYER_LOCKED': {
                if (this.onPlayerLocked) {
                  this.onPlayerLocked(data);
                }
                break;
              }

              case 'START_COUNTDOWN': {
                if (this.onStartCountdown) {
                  this.onStartCountdown(data);
                }
                break;
              }

              case 'ROUND_RESULT': {
                if (this.onRoundResult) {
                  this.onRoundResult(data);
                }
                break;
              }

              case 'INCORRECT_ANSWER': {
                if (this.onIncorrectAnswer) {
                  this.onIncorrectAnswer(data.message);
                }
                break;
              }

              case 'REMATCH': {
                if (this.onRematch) {
                  this.onRematch();
                }
                break;
              }

              case 'CHAT': {
                if (this.onChatMessage) {
                  this.onChatMessage(data);
                }
                break;
              }

              default:
                break;
            }
          });

          conn.on('close', () => {
            if (this.onPlayerDisconnect) {
              this.onPlayerDisconnect('Host disconnected or room closed.');
            }
          });

          conn.on('error', (err) => {
            console.error('[MatinikPeer] Guest Conn Error:', err);
            if (this.onError) {
              this.onError('Connection to host was interrupted.');
            }
          });
        });

        this.peer.on('error', (err) => {
          console.error('[MatinikPeer] Peer Error:', err);
          if (this.onError) {
            this.onError('Could not find room. Check the code and try again.');
          }
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Broadcast message to all connected peers
   */
  broadcast(data, excludePeerId = null) {
    if (this.isHost) {
      this.connections.forEach(({ conn }, peerId) => {
        if (conn && conn.open && peerId !== excludePeerId) {
          try {
            conn.send(data);
          } catch (e) {
            console.warn('[MatinikPeer] Broadcast failed to peer:', peerId, e);
          }
        }
      });
    } else if (this.hostConn && this.hostConn.open) {
      try {
        this.hostConn.send(data);
      } catch (e) {
        console.warn('[MatinikPeer] Send to host failed:', e);
      }
    }
  }

  sendToHost(data) {
    if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(data);
    }
  }

  sendToPlayer(playerId, data) {
    if (!this.isHost) return;
    for (const { conn, playerId: id } of this.connections.values()) {
      if (id === playerId && conn && conn.open) {
        conn.send(data);
        break;
      }
    }
  }

  sendChatMessage(text) {
    const payload = {
      type: 'CHAT',
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: this.playerId,
      senderName: this.playerName,
      text,
      timestamp: Date.now()
    };
    this.broadcast(payload);
    return payload;
  }

  broadcastGameStart(data) {
    this.broadcast({
      type: 'GAME_START',
      ...data
    });
  }

  broadcastStartRound(data) {
    this.broadcast({
      type: 'START_ROUND',
      ...data
    });
  }

  broadcastPlayerLocked(playerId, playerName) {
    this.broadcast({
      type: 'PLAYER_LOCKED',
      playerId,
      playerName
    });
  }

  broadcastStartCountdown(data) {
    this.broadcast({
      type: 'START_COUNTDOWN',
      ...data
    });
  }

  broadcastRoundResult(data) {
    this.broadcast({
      type: 'ROUND_RESULT',
      ...data
    });
  }

  broadcastRematch() {
    this.broadcast({
      type: 'REMATCH'
    });
  }

  sendNumberToHost(number) {
    this.sendToHost({
      type: 'SUBMIT_NUMBER',
      playerId: this.playerId,
      playerName: this.playerName,
      number
    });
  }

  sendAnswerToHost(answer, timeTaken) {
    this.sendToHost({
      type: 'SUBMIT_ANSWER',
      playerId: this.playerId,
      playerName: this.playerName,
      answer,
      timeTaken
    });
  }

  destroy() {
    if (this.connections) {
      this.connections.forEach(({ conn }) => {
        try { conn.close(); } catch (e) {}
      });
      this.connections.clear();
    }
    if (this.hostConn) {
      try { this.hostConn.close(); } catch (e) {}
      this.hostConn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.players = [];
  }
}

let instance = null;

export function getMatinikPeerManager() {
  if (!instance) {
    instance = new MatinikPeerManager();
  }
  return instance;
}

export function resetMatinikPeerManager() {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
