import { Peer } from 'peerjs';
import { createUnoDeck, canPlayCard, CARD_TYPES, UNO_COLORS } from '../data/unoDeck.js';

const UNO_PEER_PREFIX = 'uno-v1-';

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

export class UnoPeerManager {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.roomCode = null;
    this.playerId = null;
    this.playerName = 'Ace';
    this.maxPlayers = 4;

    // Host tracks guest connections
    this.connections = new Map();
    // Guest tracks host connection
    this.hostConn = null;

    // Full Game State
    this.players = []; // Array<{ id, name, isHost, cardCount, connected, saidUno }>
    this.playerHands = {}; // Host authoritative hands: Map<playerId, Card[]>
    this.myHand = []; // Local player's cards
    this.drawPile = [];
    this.discardPile = [];
    this.topCard = null;
    this.activeColor = null; // 'RED' | 'BLUE' | 'GREEN' | 'YELLOW'
    this.currentTurnPlayerId = null;
    this.direction = 1; // 1 = clockwise, -1 = counter-clockwise
    this.gameState = 'LOBBY'; // 'LOBBY' | 'PLAYING' | 'FINISHED'
    this.winner = null;
    this.messages = [];
    this.hasDrawnThisTurn = false;
    this.pendingDrawCount = 0;

    // Event hooks
    this.onStateUpdate = null;
    this.onPlayersUpdate = null;
    this.onToast = null;
    this.onStatusChange = null;
    this.onError = null;
  }

  static generateCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  destroy() {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }
    this.connections.clear();
    this.hostConn = null;
    this.players = [];
    this.playerHands = {};
    this.myHand = [];
    this.drawPile = [];
    this.discardPile = [];
    this.topCard = null;
    this.gameState = 'LOBBY';
    this.winner = null;
    this.messages = [];
    this.hasDrawnThisTurn = false;
    this.pendingDrawCount = 0;
  }

  /**
   * Leave current room and notify peers
   */
  leaveRoom() {
    if (this.hostConn && this.hostConn.open) {
      try {
        this.hostConn.send({
          type: 'GUEST_LEAVE',
          playerId: this.playerId
        });
      } catch (e) {}
    }
    this.destroy();
  }

  /**
   * Host creates an online UNO room
   */
  createRoom({ name = 'Ace', maxPlayers = 4 }) {
    this.destroy();
    this.isHost = true;
    this.roomCode = UnoPeerManager.generateCode();
    this.playerName = name.trim() || 'Ace';
    this.playerId = `player_${Math.random().toString(36).substring(2, 8)}`;
    this.maxPlayers = Math.min(8, Math.max(2, maxPlayers));

    this.players = [
      {
        id: this.playerId,
        name: this.playerName,
        isHost: true,
        cardCount: 0,
        connected: true,
        saidUno: false
      }
    ];
    this.playerHands = { [this.playerId]: [] };
    this.gameState = 'LOBBY';

    const peerId = `${UNO_PEER_PREFIX}${this.roomCode.toLowerCase()}`;

    return new Promise((resolve, reject) => {
      try {
        this.peer = new Peer(peerId, { config: ICE_CONFIG, debug: 0 });

        this.peer.on('open', () => {
          this._broadcastState();
          resolve({
            roomCode: this.roomCode,
            playerId: this.playerId,
            players: this.players
          });
        });

        this.peer.on('connection', (conn) => {
          this._handleHostIncomingConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('[UnoPeer] Host Peer Error:', err);
          if (err.type === 'unavailable-id') {
            this.createRoom({ name, maxPlayers }).then(resolve).catch(reject);
          } else {
            if (this.onError) this.onError(err.message || 'Host connection error.');
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Guest joins an existing UNO room
   */
  joinRoom({ roomCode, name = 'Ace' }) {
    this.destroy();
    this.isHost = false;
    this.roomCode = roomCode.toUpperCase().trim();
    this.playerName = name.trim() || 'Ace';
    this.playerId = `player_${Math.random().toString(36).substring(2, 8)}`;

    const hostPeerId = `${UNO_PEER_PREFIX}${this.roomCode.toLowerCase()}`;
    const myGuestPeerId = `${UNO_PEER_PREFIX}guest-${this.playerId}-${Math.random().toString(36).substring(2, 5)}`;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.destroy();
          reject(new Error('Room not found or host unreachable. Check room code.'));
        }
      }, 12000);

      try {
        this.peer = new Peer(myGuestPeerId, { config: ICE_CONFIG, debug: 0 });

        this.peer.on('open', () => {
          const conn = this.peer.connect(hostPeerId, { reliable: true });
          this.hostConn = conn;

          conn.on('open', () => {
            // Handshake with host
            conn.send({
              type: 'GUEST_JOIN',
              playerId: this.playerId,
              playerName: this.playerName
            });
          });

          conn.on('data', (data) => {
            if (data.type === 'JOIN_SUCCESS') {
              if (!settled) {
                settled = true;
                clearTimeout(timeout);
                resolve({
                  roomCode: this.roomCode,
                  playerId: this.playerId
                });
              }
            } else if (data.type === 'STATE_UPDATE') {
              this._applyClientState(data.state, data.yourHand);
            } else if (data.type === 'TOAST') {
              if (this.onToast) this.onToast(data.message, data.toastType);
            }
          });

          conn.on('close', () => {
            if (this.onToast) this.onToast('Disconnected from host.', 'error');
          });

          conn.on('error', (err) => {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              reject(err);
            }
          });
        });

        this.peer.on('error', (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(err);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  // --- HOST LOGIC ---

  _handleHostIncomingConnection(conn) {
    conn.on('data', (data) => {
      if (data.type === 'GUEST_JOIN') {
        if (this.players.length >= this.maxPlayers) {
          conn.send({ type: 'ERROR', message: 'Room is full.' });
          conn.close();
          return;
        }

        const newPlayer = {
          id: data.playerId,
          name: data.playerName,
          isHost: false,
          cardCount: 0,
          connected: true,
          saidUno: false
        };

        this.connections.set(data.playerId, { conn, name: data.playerName });
        this.players = [...this.players, newPlayer];
        this.playerHands[data.playerId] = [];

        conn.send({ type: 'JOIN_SUCCESS' });
        this._addMessage('SYSTEM', `👋 ${data.playerName} joined the room!`);

        // If game is in progress, deal 7 cards to the new player
        if (this.gameState === 'PLAYING') {
          this._drawCardsForPlayer(data.playerId, 7);
        }

        if (this.onPlayersUpdate) {
          this.onPlayersUpdate(this.players.map((p) => ({ ...p })));
        }

        this._broadcastState();
      } else if (data.type === 'PLAY_CARD') {
        this.hostPlayCard(data.playerId, data.cardId, data.chosenColor);
      } else if (data.type === 'DRAW_CARD') {
        this.hostDrawCard(data.playerId);
      } else if (data.type === 'PASS_TURN') {
        this.hostPassTurn(data.playerId);
      } else if (data.type === 'CALL_UNO') {
        this.hostCallUno(data.playerId);
      } else if (data.type === 'CATCH_UNO') {
        this.hostCatchUno(data.playerId, data.targetPlayerId);
      } else if (data.type === 'CHAT_MESSAGE') {
        this._addMessage('CHAT', data.text, data.playerName, data.playerId);
        this._broadcastState();
      } else if (data.type === 'GUEST_LEAVE') {
        this._removePlayer(data.playerId);
      }
    });

    conn.on('close', () => {
      // Find disconnected player
      for (const [pId, info] of this.connections.entries()) {
        if (info.conn === conn) {
          this._removePlayer(pId);
          break;
        }
      }
    });
  }

  _removePlayer(pId) {
    this.connections.delete(pId);
    const p = this.players.find((pl) => pl.id === pId);
    if (!p) return;

    delete this.playerHands[pId];

    // In Lobby or if match is finished, remove them completely to free up their slot
    if (this.gameState === 'LOBBY' || this.gameState === 'FINISHED') {
      this.players = this.players.filter((pl) => pl.id !== pId);
    } else {
      this.players = this.players.map((pl) => (pl.id === pId ? { ...pl, connected: false } : pl));
      // If it was their turn, advance
      if (this.currentTurnPlayerId === pId) {
        this._advanceTurn(1);
      }
    }

    this._addMessage('SYSTEM', `🚪 ${p.name} left the room.`);

    if (this.onPlayersUpdate) {
      this.onPlayersUpdate(this.players.map((pl) => ({ ...pl })));
    }

    this._broadcastState();
  }

  /**
   * Host starts the UNO game
   */
  hostStartGame() {
    if (!this.isHost || this.players.length < 2) return;

    const fullDeck = createUnoDeck();
    this.drawPile = fullDeck;
    this.discardPile = [];
    this.playerHands = {};
    this.direction = 1;
    this.winner = null;
    this.hasDrawnThisTurn = false;
    this.pendingDrawCount = 0;

    // Deal 7 cards to each player
    this.players.forEach((p) => {
      p.cardCount = 7;
      p.saidUno = false;
      this.playerHands[p.id] = this.drawPile.splice(0, 7);
    });

    // Flip top card from draw pile to start discard pile (make sure first card is not Wild +4)
    let initialCard = this.drawPile.shift();
    while (initialCard.type === CARD_TYPES.WILD_DRAW_FOUR) {
      this.drawPile.push(initialCard);
      initialCard = this.drawPile.shift();
    }

    this.discardPile.push(initialCard);
    this.topCard = initialCard;
    this.activeColor = initialCard.color === 'WILD' ? 'RED' : initialCard.color;

    this.gameState = 'PLAYING';
    this.currentTurnPlayerId = this.players[0].id;

    this._addMessage('SYSTEM', `🎮 Uno Match Started! Top card is ${this.activeColor} ${initialCard.label}.`);
    this._broadcastState();
  }

  /**
   * Host executes playing a card
   */
  hostPlayCard(playerId, cardId, chosenColor) {
    if (this.gameState !== 'PLAYING') return;
    if (this.currentTurnPlayerId !== playerId) {
      this._sendToast(playerId, "Not your turn!", 'error');
      return;
    }

    const hand = this.playerHands[playerId] || [];
    const cardIndex = hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) return;

    const card = hand[cardIndex];

    if (!canPlayCard(card, this.topCard, this.activeColor, this.pendingDrawCount)) {
      this._sendToast(playerId, "Card cannot be played on the discard pile!", 'error');
      return;
    }

    // Play card
    this.hasDrawnThisTurn = false;
    hand.splice(cardIndex, 1);
    this.discardPile.push(card);
    this.topCard = card;

    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      player.cardCount = hand.length;
    }

    // Determine active color
    if (card.color === 'WILD') {
      this.activeColor = UNO_COLORS.includes(chosenColor) ? chosenColor : 'RED';
    } else {
      this.activeColor = card.color;
    }

    this._addMessage('ACTION', `${player?.name} played ${card.color === 'WILD' ? 'Wild ' + card.label : card.color + ' ' + card.label} (Color: ${this.activeColor})`);

    // Check WIN condition!
    if (hand.length === 0) {
      this.gameState = 'FINISHED';
      this.winner = player;
      this._addMessage('SYSTEM', `🏆 ${player?.name} won the UNO match! 🎉`);
      this._broadcastState();
      return;
    }

    // Reset Uno status if they now have more than 1 card or failed to call Uno
    if (hand.length > 1 && player) {
      player.saidUno = false;
    }

    // Handle special action cards
    let stepsToAdvance = 1;

    if (card.type === CARD_TYPES.REVERSE) {
      if (this.players.length === 2) {
        // In 2 player, reverse acts like skip
        stepsToAdvance = 2;
        this._addMessage('ACTION', `🔄 Reversed & Skipped! It's ${player?.name}'s turn again.`);
      } else {
        this.direction *= -1;
        this._addMessage('ACTION', `🔄 Direction reversed!`);
        stepsToAdvance = 1;
      }
    } else if (card.type === CARD_TYPES.SKIP) {
      stepsToAdvance = 2;
      const skippedPlayer = this._getNextPlayer(1);
      this._addMessage('ACTION', `⊘ ${skippedPlayer?.name} was skipped!`);
    } else if (card.type === CARD_TYPES.DRAW_TWO) {
      this.pendingDrawCount += 2;
      this._addMessage('ACTION', `💥 ${player?.name} played +2! Penalty is now +${this.pendingDrawCount}!`);
      stepsToAdvance = 1;
    } else if (card.type === CARD_TYPES.WILD_DRAW_FOUR) {
      this.pendingDrawCount += 4;
      this._addMessage('ACTION', `💥💥 ${player?.name} played +4! Penalty is now +${this.pendingDrawCount}!`);
      stepsToAdvance = 1;
    }

    this._advanceTurn(stepsToAdvance);
    this._broadcastState();
  }

  /**
   * Host processes drawing a card (Max 1 draw per turn, or draws pending stack)
   */
  hostDrawCard(playerId) {
    if (this.gameState !== 'PLAYING' || this.currentTurnPlayerId !== playerId) return;

    const player = this.players.find((p) => p.id === playerId);

    // If there is an active stacked penalty (+2 or +4)
    if (this.pendingDrawCount > 0) {
      const penalty = this.pendingDrawCount;
      this._drawCardsForPlayer(playerId, penalty);
      if (player) player.saidUno = false;
      this._addMessage('ACTION', `💥 ${player?.name} could not counter and drew ${penalty} penalty cards!`);
      this.pendingDrawCount = 0;
      this.hasDrawnThisTurn = false;
      this._advanceTurn(1);
      this._broadcastState();
      return;
    }

    if (this.hasDrawnThisTurn) {
      this._sendToast(playerId, 'You can only draw 1 card per turn! Throw a card or pass.', 'error');
      return;
    }

    this.hasDrawnThisTurn = true;
    const drawnCards = this._drawCardsForPlayer(playerId, 1);
    if (player) player.saidUno = false;

    this._addMessage('ACTION', `${player?.name} drew 1 card.`);
    this._broadcastState();
  }

  /**
   * Host passes turn (allowed only after drawing 1 card and no active stack)
   */
  hostPassTurn(playerId) {
    if (this.gameState !== 'PLAYING' || this.currentTurnPlayerId !== playerId) return;

    if (this.pendingDrawCount > 0) {
      this._sendToast(playerId, `You must drop a matching plus card or draw +${this.pendingDrawCount} cards!`, 'error');
      return;
    }

    if (!this.hasDrawnThisTurn) {
      this._sendToast(playerId, 'You must draw 1 card before you can pass your turn!', 'error');
      return;
    }

    const player = this.players.find((p) => p.id === playerId);
    this._addMessage('ACTION', `${player?.name} passed their turn.`);
    this.hasDrawnThisTurn = false;
    this._advanceTurn(1);
    this._broadcastState();
  }

  /**
   * Player shouts "UNO!"
   */
  hostCallUno(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    const hand = this.playerHands[playerId] || [];
    if (!player) return;

    if (hand.length <= 2) {
      player.saidUno = true;
      this._addMessage('UNO', `🔴 ${player.name} yelled "UNO!" 🎴`);
      this._broadcastState();
    }
  }

  /**
   * Catch player who didn't say UNO with 1 card left!
   */
  hostCatchUno(callerId, targetPlayerId) {
    const target = this.players.find((p) => p.id === targetPlayerId);
    const hand = this.playerHands[targetPlayerId] || [];
    const caller = this.players.find((p) => p.id === callerId);

    if (target && hand.length === 1 && !target.saidUno) {
      this._drawCardsForPlayer(targetPlayerId, 2);
      this._addMessage('SYSTEM', `🚨 ${caller?.name} caught ${target.name} not saying UNO! +2 penalty cards!`);
      this._broadcastState();
    }
  }

  // --- INTERNAL ENGINE HELPERS ---

  _drawCardsForPlayer(playerId, count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        // Recycle discard pile
        if (this.discardPile.length > 1) {
          const top = this.discardPile.pop();
          this.drawPile = createUnoDeck(); // Refresh deck
          this.discardPile.push(top);
        } else {
          this.drawPile = createUnoDeck();
        }
      }
      if (this.drawPile.length > 0) {
        drawn.push(this.drawPile.shift());
      }
    }

    if (!this.playerHands[playerId]) {
      this.playerHands[playerId] = [];
    }
    this.playerHands[playerId].push(...drawn);

    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      player.cardCount = this.playerHands[playerId].length;
    }

    return drawn;
  }

  _getNextPlayer(offset = 1) {
    const active = this.players.filter((p) => p.connected);
    if (active.length === 0) return null;

    const currentIdx = active.findIndex((p) => p.id === this.currentTurnPlayerId);
    let nextIdx = (currentIdx + this.direction * offset) % active.length;
    if (nextIdx < 0) nextIdx += active.length;
    return active[nextIdx];
  }

  _advanceTurn(steps = 1) {
    this.hasDrawnThisTurn = false;
    const nextPlayer = this._getNextPlayer(steps);
    if (nextPlayer) {
      this.currentTurnPlayerId = nextPlayer.id;
    }
  }

  _addMessage(type, text, sender = '', senderId = '') {
    this.messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      text,
      sender: sender || (type === 'SYSTEM' ? 'System' : ''),
      senderId,
      timestamp: Date.now()
    });
    if (this.messages.length > 50) {
      this.messages = this.messages.slice(-50);
    }
  }

  _sendToast(playerId, message, toastType = 'info') {
    if (playerId === this.playerId) {
      if (this.onToast) this.onToast(message, toastType);
    } else {
      const connInfo = this.connections.get(playerId);
      if (connInfo && connInfo.conn) {
        connInfo.conn.send({ type: 'TOAST', message, toastType });
      }
    }
  }

  _broadcastState() {
    const publicState = {
      roomCode: this.roomCode,
      players: this.players.map((p) => ({ ...p })),
      topCard: this.topCard ? { ...this.topCard } : null,
      activeColor: this.activeColor,
      currentTurnPlayerId: this.currentTurnPlayerId,
      direction: this.direction,
      gameState: this.gameState,
      winner: this.winner ? { ...this.winner } : null,
      messages: [...this.messages],
      drawPileCount: this.drawPile.length,
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      pendingDrawCount: this.pendingDrawCount
    };

    // Update host state locally
    this.myHand = [...(this.playerHands[this.playerId] || [])];
    this._applyClientState(publicState, this.myHand);

    // Send personalized state (with their private hand) to each connected guest
    for (const [pId, info] of this.connections.entries()) {
      if (info.conn && info.conn.open) {
        info.conn.send({
          type: 'STATE_UPDATE',
          state: publicState,
          yourHand: [...(this.playerHands[pId] || [])]
        });
      }
    }
  }

  _applyClientState(state, hand) {
    this.roomCode = state.roomCode;
    this.players = (state.players || []).map((p) => ({ ...p }));
    this.topCard = state.topCard;
    this.activeColor = state.activeColor;
    this.currentTurnPlayerId = state.currentTurnPlayerId;
    this.direction = state.direction;
    this.gameState = state.gameState;
    this.winner = state.winner;
    this.messages = [...(state.messages || [])];
    this.drawPileCount = state.drawPileCount;
    this.hasDrawnThisTurn = !!state.hasDrawnThisTurn;
    this.pendingDrawCount = state.pendingDrawCount || 0;
    if (hand) this.myHand = [...hand];

    if (this.onPlayersUpdate) {
      this.onPlayersUpdate(this.players.map((p) => ({ ...p })));
    }

    if (this.onStateUpdate) {
      this.onStateUpdate({
        ...state,
        players: this.players.map((p) => ({ ...p })),
        messages: [...this.messages],
        myHand: [...this.myHand],
        playerId: this.playerId,
        isHost: this.isHost,
        hasDrawnThisTurn: this.hasDrawnThisTurn,
        pendingDrawCount: this.pendingDrawCount
      });
    }
  }

  // --- CLIENT ACTIONS (Callable by both Host and Guest) ---

  playCard(cardId, chosenColor) {
    if (this.isHost) {
      this.hostPlayCard(this.playerId, cardId, chosenColor);
    } else if (this.hostConn) {
      this.hostConn.send({
        type: 'PLAY_CARD',
        playerId: this.playerId,
        cardId,
        chosenColor
      });
    }
  }

  drawCard() {
    if (this.isHost) {
      this.hostDrawCard(this.playerId);
    } else if (this.hostConn) {
      this.hostConn.send({
        type: 'DRAW_CARD',
        playerId: this.playerId
      });
    }
  }

  passTurn() {
    if (this.isHost) {
      this.hostPassTurn(this.playerId);
    } else if (this.hostConn) {
      this.hostConn.send({
        type: 'PASS_TURN',
        playerId: this.playerId
      });
    }
  }

  callUno() {
    if (this.isHost) {
      this.hostCallUno(this.playerId);
    } else if (this.hostConn) {
      this.hostConn.send({
        type: 'CALL_UNO',
        playerId: this.playerId
      });
    }
  }

  catchUno(targetPlayerId) {
    if (this.isHost) {
      this.hostCatchUno(this.playerId, targetPlayerId);
    } else if (this.hostConn) {
      this.hostConn.send({
        type: 'CATCH_UNO',
        playerId: this.playerId,
        targetPlayerId
      });
    }
  }

  sendChatMessage(text) {
    if (this.isHost) {
      this._addMessage('CHAT', text, this.playerName, this.playerId);
      this._broadcastState();
    } else if (this.hostConn) {
      this.hostConn.send({
        type: 'CHAT_MESSAGE',
        playerId: this.playerId,
        playerName: this.playerName,
        text
      });
    }
  }
}

let unoManagerInstance = null;

export function getUnoPeerManager() {
  if (!unoManagerInstance) {
    unoManagerInstance = new UnoPeerManager();
  }
  return unoManagerInstance;
}
