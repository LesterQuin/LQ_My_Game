const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Checks server health.
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    return await res.json();
  } catch (err) {
    return { success: false, message: 'Server is unavailable.' };
  }
}

/**
 * Verifies if a room exists before joining.
 * @param {string} roomCode
 */
export async function verifyRoom(roomCode) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/rooms/${roomCode.toUpperCase()}`);
    return await res.json();
  } catch (err) {
    return { success: false, message: 'Could not connect to server.' };
  }
}
