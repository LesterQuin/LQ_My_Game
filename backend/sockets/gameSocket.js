import {
  createRoom,
  getRoom,
  joinRoom,
  disconnectPlayer,
  removePlayer,
  getSanitizedRoomState
} from '../services/roomManager.js';
import {
  startGame,
  drawCard,
  submitAnswer,
  nextTurn,
  playAgain
} from '../services/gameManager.js';
import {
  validatePlayerName,
  generatePlayerId
} from '../utils/sanitize.js';
import { normalizeRoomCode, isValidRoomCode } from '../utils/roomCode.js';

export function setupGameSocket(io) {
  io.on('connection', (socket) => {
    // 1. Create room
    socket.on('room:create', ({ name }, callback = () => {}) => {
      try {
        const nameValidation = validatePlayerName(name);
        if (!nameValidation.valid) {
          return callback({ success: false, message: nameValidation.error });
        }

        const playerId = generatePlayerId();
        const room = createRoom(nameValidation.sanitized, playerId, socket.id);

        socket.join(room.roomCode);

        const state = getSanitizedRoomState(room);
        callback({
          success: true,
          roomCode: room.roomCode,
          playerId,
          roomState: state
        });
      } catch (err) {
        callback({ success: false, message: err.message || 'Failed to create room.' });
      }
    });

    // 2. Join room
    socket.on('room:join', ({ roomCode, name, playerId }, callback = () => {}) => {
      try {
        const normalized = normalizeRoomCode(roomCode);
        if (!isValidRoomCode(normalized)) {
          return callback({ success: false, message: 'That room code is invalid.' });
        }

        const room = getRoom(normalized);
        if (!room) {
          return callback({ success: false, message: 'Room not found.' });
        }

        let assignedPlayerId = playerId;
        let sanitizedName = name;

        // If player already exists in room, they are reconnecting
        const existingPlayer = assignedPlayerId
          ? room.players.find((p) => p.playerId === assignedPlayerId)
          : null;

        if (!existingPlayer) {
          const nameValidation = validatePlayerName(name);
          if (!nameValidation.valid) {
            return callback({ success: false, message: nameValidation.error });
          }
          sanitizedName = nameValidation.sanitized;
          assignedPlayerId = generatePlayerId();
        }

        const updatedRoom = joinRoom(
          normalized,
          sanitizedName,
          assignedPlayerId,
          socket.id
        );

        socket.join(normalized);

        const state = getSanitizedRoomState(updatedRoom);

        // Notify caller
        callback({
          success: true,
          roomCode: normalized,
          playerId: assignedPlayerId,
          roomState: state
        });

        // Broadcast to entire room
        socket.to(normalized).emit('room:player_joined', {
          playerId: assignedPlayerId,
          name: sanitizedName
        });
        io.to(normalized).emit('room:state', state);
      } catch (err) {
        callback({ success: false, message: err.message || 'Failed to join room.' });
      }
    });

    // 3. Reconnect player
    socket.on('player:reconnect', ({ roomCode, playerId }, callback = () => {}) => {
      try {
        const normalized = normalizeRoomCode(roomCode);
        const room = getRoom(normalized);

        if (!room) {
          return callback({
            success: false,
            message: 'This game is no longer available.'
          });
        }

        const player = room.players.find((p) => p.playerId === playerId);
        if (!player) {
          return callback({
            success: false,
            message: 'Player session expired or not found in this room.'
          });
        }

        // Mark player active with new socket
        player.connected = true;
        player.socketId = socket.id;
        room.lastActivityAt = Date.now();

        socket.join(normalized);

        const state = getSanitizedRoomState(room);
        callback({ success: true, roomState: state });

        // Notify room
        io.to(normalized).emit('room:state', state);
      } catch (err) {
        callback({
          success: false,
          message: err.message || 'Reconnection failed.'
        });
      }
    });

    // 4. Leave room
    socket.on('room:leave', ({ roomCode, playerId }, callback = () => {}) => {
      try {
        const normalized = normalizeRoomCode(roomCode);
        socket.leave(normalized);

        const remainingRoom = removePlayer(normalized, playerId);
        if (remainingRoom) {
          io.to(normalized).emit('room:state', getSanitizedRoomState(remainingRoom));
        }

        callback({ success: true });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });

    // 5. Start game
    socket.on('game:start', ({ roomCode, playerId }, callback = () => {}) => {
      try {
        const normalized = normalizeRoomCode(roomCode);
        const room = startGame(normalized, playerId);

        const state = getSanitizedRoomState(room);
        io.to(normalized).emit('game:started', state);
        io.to(normalized).emit('room:state', state);

        callback({ success: true });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });

    // 6. Draw card
    socket.on('game:draw_card', ({ roomCode, playerId }, callback = () => {}) => {
      try {
        const normalized = normalizeRoomCode(roomCode);
        const { room, card } = drawCard(normalized, playerId);

        const state = getSanitizedRoomState(room);
        io.to(normalized).emit('game:card_drawn', { card, roomState: state });
        io.to(normalized).emit('room:state', state);

        callback({ success: true, card });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });

    // 7. Submit answer (temporary, not logged to server console)
    socket.on('game:submit_answer', ({ roomCode, playerId, text }, callback = () => {}) => {
      try {
        const normalized = normalizeRoomCode(roomCode);
        const { room, answer } = submitAnswer(normalized, playerId, text);

        const state = getSanitizedRoomState(room);
        io.to(normalized).emit('game:answer_submitted', { answer, roomState: state });
        io.to(normalized).emit('room:state', state);

        callback({ success: true, answer });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });

    // 8. Next turn
    socket.on('game:next_turn', ({ roomCode, playerId }, callback = () => {}) => {
      try {
        const normalized = normalizeRoomCode(roomCode);
        const { room, finished } = nextTurn(normalized, playerId);

        const state = getSanitizedRoomState(room);
        if (finished) {
          io.to(normalized).emit('game:finished', state);
        }
        io.to(normalized).emit('room:state', state);

        callback({ success: true, finished });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });

    // 9. Play again
    socket.on('game:play_again', ({ roomCode, playerId }, callback = () => {}) => {
      try {
        const normalized = normalizeRoomCode(roomCode);
        const room = playAgain(normalized, playerId);

        const state = getSanitizedRoomState(room);
        io.to(normalized).emit('game:restarted', state);
        io.to(normalized).emit('room:state', state);

        callback({ success: true });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });

    // 10. Disconnect
    socket.on('disconnect', () => {
      const result = disconnectPlayer(socket.id);
      if (result) {
        const { room } = result;
        const state = getSanitizedRoomState(room);
        io.to(room.roomCode).emit('room:state', state);
      }
    });
  });
}
