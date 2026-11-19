import { Peer } from 'peerjs';

const TTT_PEER_PREFIX = 'ttt-v2-';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:openrelay.metered.ca:80' }
  ]
};

export class TicTacPeerManager {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomCode = null;
    this.playerName = 'Player';
    this.opponentName = 'Opponent';

    // Callbacks
    this.onConnected = null;
    this.onMove = null;
    this.onRematch = null;
    this.onResetScores = null;
    this.onOpponentDisconnect = null;
    this.onError = null;
    this.onStatusChange = null;
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
   * Host creates a new online room
   */
  createRoom(playerName = 'Host') {
    this.destroy();
    this.isHost = true;
    this.playerName = playerName.trim() || 'Player 1';
    this.roomCode = TicTacPeerManager.generateCode();
    const peerId = `${TTT_PEER_PREFIX}${this.roomCode}`;

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
            this.onStatusChange('Waiting for opponent to connect...');
          }
          resolve(this.roomCode);
        });

        this.peer.on('connection', (conn) => {
          // If already connected to an opponent, reject duplicate
          if (this.conn && this.conn.open) {
            conn.close();
            return;
          }

          this.conn = conn;
          this._setupConnectionHandlers();
        });

        this.peer.on('error', (err) => {
          console.error('[TicTacPeer] Error:', err);
          if (err.type === 'unavailable-id') {
            // Collision, retry with new code
            this.createRoom(playerName).then(resolve).catch(reject);
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

  /**
   * Guest joins an existing room by code
   */
  joinRoom(roomCode, playerName = 'Guest') {
    this.destroy();
    this.isHost = false;
    this.playerName = playerName.trim() || 'Player 2';
    const normalized = TicTacPeerManager.normalizeCode(roomCode);
    this.roomCode = normalized;
    const targetPeerId = `${TTT_PEER_PREFIX}${normalized}`;

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
          const conn = this.peer.connect(targetPeerId, {
            reliable: true
          });
          this.conn = conn;
          this._setupConnectionHandlers();
          resolve(normalized);
        });

        this.peer.on('error', (err) => {
          console.error('[TicTacPeer] Error:', err);
          if (this.onError) this.onError('Could not connect to room. Check the code and try again.');
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  _setupConnectionHandlers() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      // Send handshake
      this.conn.send({
        type: 'HANDSHAKE',
        name: this.playerName,
        isHost: this.isHost
      });
    });

    this.conn.on('data', (data) => {
      if (!data || !data.type) return;

      switch (data.type) {
        case 'HANDSHAKE': {
          this.opponentName = data.name || (this.isHost ? 'Guest' : 'Host');
          // If host receives handshake, acknowledge back
          if (this.isHost) {
            this.conn.send({
              type: 'HANDSHAKE_ACK',
              name: this.playerName
            });
          }

          if (this.onConnected) {
            this.onConnected({
              role: this.isHost ? 'X' : 'O',
              opponentName: this.opponentName,
              isHost: this.isHost
            });
          }
          break;
        }

        case 'HANDSHAKE_ACK': {
          this.opponentName = data.name || 'Host';
          if (this.onConnected) {
            this.onConnected({
              role: 'O',
              opponentName: this.opponentName,
              isHost: false
            });
          }
          break;
        }

        case 'MOVE': {
          if (this.onMove) {
            this.onMove({ index: data.index, symbol: data.symbol });
          }
          break;
        }

        case 'REMATCH': {
          if (this.onRematch) {
            this.onRematch(data.isXNext);
          }
          break;
        }

        case 'RESET_SCORES': {
          if (this.onResetScores) {
            this.onResetScores();
          }
          break;
        }

        default:
          break;
      }
    });

    this.conn.on('close', () => {
      if (this.onOpponentDisconnect) {
        this.onOpponentDisconnect();
      }
    });

    this.conn.on('error', (err) => {
      console.warn('[TicTacPeer] Conn error:', err);
      if (this.onError) {
        this.onError('Peer connection issue.');
      }
    });
  }

  sendMove(index, symbol) {
    if (this.conn && this.conn.open) {
      this.conn.send({
        type: 'MOVE',
        index,
        symbol
      });
    }
  }

  sendRematch(isXNext = true) {
    if (this.conn && this.conn.open) {
      this.conn.send({
        type: 'REMATCH',
        isXNext
      });
    }
  }

  sendResetScores() {
    if (this.conn && this.conn.open) {
      this.conn.send({
        type: 'RESET_SCORES'
      });
    }
  }

  destroy() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch (e) {}
      this.conn = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }

    this.roomCode = null;
    this.isHost = false;
  }
}
