import { getAllRooms, deleteRoom } from '../services/roomManager.js';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const FINISHED_GAME_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const ABANDONED_GAME_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes with no connected players
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000; // Run every 2 minutes

/**
 * Runs one pass of cleanup across all active temporary rooms.
 * @returns {number} Count of cleaned rooms
 */
export function cleanExpiredRooms() {
  const rooms = getAllRooms();
  const now = Date.now();
  let cleanedCount = 0;

  for (const [roomCode, room] of rooms.entries()) {
    const inactiveDuration = now - room.lastActivityAt;
    const connectedPlayersCount = room.players.filter((p) => p.connected).length;

    // 1. Delete if completely empty
    if (room.players.length === 0) {
      deleteRoom(roomCode);
      cleanedCount++;
      continue;
    }

    // 2. Delete if finished and older than timeout
    if (room.status === 'FINISHED' && inactiveDuration > FINISHED_GAME_TIMEOUT_MS) {
      deleteRoom(roomCode);
      cleanedCount++;
      continue;
    }

    // 3. Delete if abandoned (0 connected players) for > 15 mins
    if (connectedPlayersCount === 0 && inactiveDuration > ABANDONED_GAME_TIMEOUT_MS) {
      deleteRoom(roomCode);
      cleanedCount++;
      continue;
    }

    // 4. Delete if inactive for > 30 mins
    if (inactiveDuration > INACTIVITY_TIMEOUT_MS) {
      deleteRoom(roomCode);
      cleanedCount++;
      continue;
    }
  }

  return cleanedCount;
}

/**
 * Starts the automatic background room cleanup scheduler.
 * @returns {NodeJS.Timeout}
 */
export function startRoomCleanupScheduler() {
  const timer = setInterval(() => {
    try {
      cleanExpiredRooms();
    } catch (err) {
      console.error('[RoomCleanup] Error running scheduled cleanup:', err.message);
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow process to exit cleanly if timer is running
  if (timer.unref) {
    timer.unref();
  }

  return timer;
}
