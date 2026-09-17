import { generateRoomCode, normalizeRoomCode } from '../utils/roomCode.js';

// In-memory room storage Map<string, Room>
const rooms = new Map();

/**
 * Creates a new temporary room.
 * @param {string} hostName
 * @param {string} hostPlayerId
 * @param {string} socketId
 * @returns {object} The created room object
 */
export function createRoom(hostName, hostPlayerId, socketId) {
  let roomCode = '';
  let attempts = 0;

  do {
    roomCode = generateRoomCode();
    attempts++;
  } while (rooms.has(roomCode) && attempts < 20);

  if (rooms.has(roomCode)) {
    throw new Error('Could not generate a unique room code. Please try again.');
  }

  const room = {
    roomCode,
    hostPlayerId,
    status: 'LOBBY', // 'LOBBY' | 'PLAYING' | 'FINISHED'
    players: [
      {
        playerId: hostPlayerId,
        name: hostName,
        isHost: true,
        connected: true,
        socketId
      }
    ],
    deck: [],
    currentCardIndex: 0,
    currentPlayerIndex: 0,
    currentCardState: 'HIDDEN', // 'HIDDEN' | 'REVEALED'
    currentCard: null,
    currentAnswer: null,
    cardsAnswered: 0,
    createdAt: Date.now(),
    lastActivityAt: Date.now()
  };

  rooms.set(roomCode, room);
  return room;
}

/**
 * Retrieves a room by its normalized room code.
 * @param {string} roomCode
 * @returns {object|null}
 */
export function getRoom(roomCode) {
  const normalized = normalizeRoomCode(roomCode);
  return rooms.get(normalized) || null;
}

/**
 * Finds which room contains a player with the given socketId.
 * @param {string} socketId
 * @returns {{ room: object, player: object } | null}
 */
export function findRoomBySocketId(socketId) {
  for (const room of rooms.values()) {
    const player = room.players.find((p) => p.socketId === socketId);
    if (player) {
      return { room, player };
    }
  }
  return null;
}

/**
 * Adds a player or reconnects an existing one.
 * @param {string} roomCode
 * @param {string} playerName
 * @param {string} playerId
 * @param {string} socketId
 * @returns {object} The updated room
 */
export function joinRoom(roomCode, playerName, playerId, socketId) {
  const room = getRoom(roomCode);
  if (!room) {
    throw new Error('Room not found.');
  }

  room.lastActivityAt = Date.now();

  // Check if player ID already exists in this room (reconnection)
  const existingPlayerIndex = room.players.findIndex((p) => p.playerId === playerId);

  if (existingPlayerIndex !== -1) {
    // Reconnect existing player
    room.players[existingPlayerIndex].connected = true;
    room.players[existingPlayerIndex].socketId = socketId;
    // Update name if changed
    if (playerName) {
      room.players[existingPlayerIndex].name = playerName;
    }
    return room;
  }

  // New player joining
  if (room.status === 'FINISHED') {
    throw new Error('This game has already ended.');
  }

  // Check maximum players limit per room to prevent memory flooding
  if (room.players.length >= 12) {
    throw new Error('Room is currently full (maximum 12 players).');
  }

  // Add new player
  const newPlayer = {
    playerId,
    name: playerName,
    isHost: room.players.length === 0,
    connected: true,
    socketId
  };

  room.players.push(newPlayer);

  // If there was no host, assign this player as host
  if (!room.hostPlayerId) {
    room.hostPlayerId = playerId;
    newPlayer.isHost = true;
  }

  return room;
}

/**
 * Marks a player as disconnected without removing them immediately (allows reconnection).
 * @param {string} socketId
 * @returns {{ room: object, player: object } | null}
 */
export function disconnectPlayer(socketId) {
  const result = findRoomBySocketId(socketId);
  if (!result) return null;

  const { room, player } = result;
  player.connected = false;
  player.socketId = null;
  room.lastActivityAt = Date.now();

  return { room, player };
}

/**
 * Removes a player explicitly from a room (e.g. Leave Room).
 * @param {string} roomCode
 * @param {string} playerId
 * @returns {object|null} The updated room, or null if deleted
 */
export function removePlayer(roomCode, playerId) {
  const room = getRoom(roomCode);
  if (!room) return null;

  const playerIndex = room.players.findIndex((p) => p.playerId === playerId);
  if (playerIndex === -1) return room;

  const wasHost = room.players[playerIndex].isHost;
  room.players.splice(playerIndex, 1);
  room.lastActivityAt = Date.now();

  // If no players remain, delete the room immediately
  if (room.players.length === 0) {
    deleteRoom(roomCode);
    return null;
  }

  // If the host left, reassign host to the first connected player
  if (wasHost || room.hostPlayerId === playerId) {
    const nextConnected = room.players.find((p) => p.connected) || room.players[0];
    if (nextConnected) {
      nextConnected.isHost = true;
      room.hostPlayerId = nextConnected.playerId;
    }
  }

  // Adjust currentPlayerIndex if out of bounds
  if (room.status === 'PLAYING') {
    if (room.currentPlayerIndex >= room.players.length) {
      room.currentPlayerIndex = 0;
    }
  }

  return room;
}

/**
 * Deletes a room from memory.
 * @param {string} roomCode
 */
export function deleteRoom(roomCode) {
  const normalized = normalizeRoomCode(roomCode);
  rooms.delete(normalized);
}

/**
 * Updates a room's last activity timestamp.
 * @param {string} roomCode
 */
export function touchRoom(roomCode) {
  const room = getRoom(roomCode);
  if (room) {
    room.lastActivityAt = Date.now();
  }
}

/**
 * Returns all active rooms (for cleanup inspector).
 * @returns {Map<string, object>}
 */
export function getAllRooms() {
  return rooms;
}

/**
 * Produces a sanitized, authoritative room state safe to broadcast to clients.
 * Hides future un-drawn deck questions and internal socket IDs.
 * @param {object|string} roomOrCode
 * @returns {object|null}
 */
export function getSanitizedRoomState(roomOrCode) {
  const room = typeof roomOrCode === 'string' ? getRoom(roomOrCode) : roomOrCode;
  if (!room) return null;

  const sanitizedPlayers = room.players.map((p, index) => ({
    playerId: p.playerId,
    name: p.name,
    isHost: p.isHost,
    connected: p.connected,
    isCurrentTurn: room.status === 'PLAYING' && index === room.currentPlayerIndex
  }));

  const currentPlayer =
    room.status === 'PLAYING' && room.players[room.currentPlayerIndex]
      ? {
          playerId: room.players[room.currentPlayerIndex].playerId,
          name: room.players[room.currentPlayerIndex].name
        }
      : null;

  const totalCards = room.deck ? room.deck.length : 0;
  const cardsRemaining = room.deck ? Math.max(0, totalCards - room.currentCardIndex) : 0;

  return {
    roomCode: room.roomCode,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    players: sanitizedPlayers,
    currentPlayerIndex: room.currentPlayerIndex,
    currentPlayer,
    currentCardState: room.currentCardState,
    currentCard: room.currentCardState === 'REVEALED' ? room.currentCard : null,
    currentCardIndex: room.currentCardIndex,
    totalCards,
    cardsRemaining,
    cardsAnswered: room.cardsAnswered,
    currentAnswer: room.currentAnswer,
    createdAt: room.createdAt,
    lastActivityAt: room.lastActivityAt
  };
}
