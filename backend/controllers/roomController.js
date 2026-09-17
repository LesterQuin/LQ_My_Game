import { getRoom, getSanitizedRoomState } from '../services/roomManager.js';
import { normalizeRoomCode, isValidRoomCode } from '../utils/roomCode.js';

/**
 * Health check controller.
 */
export function healthCheck(req, res) {
  return res.status(200).json({
    success: true,
    message: 'Comfort Cards API is healthy.',
    data: {
      timestamp: Date.now(),
      status: 'ok'
    }
  });
}

/**
 * Verify if a room exists before joining.
 */
export function verifyRoom(req, res) {
  const { roomCode } = req.params;
  const normalized = normalizeRoomCode(roomCode);

  if (!isValidRoomCode(normalized)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid room code format.'
    });
  }

  const room = getRoom(normalized);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: 'Room not found or has expired.'
    });
  }

  // Return minimal safe info
  return res.status(200).json({
    success: true,
    message: 'Room found.',
    data: {
      roomCode: room.roomCode,
      status: room.status,
      playerCount: room.players.length,
      isJoinable: room.status === 'LOBBY' || room.status === 'PLAYING'
    }
  });
}
