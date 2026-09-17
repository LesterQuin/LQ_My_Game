const SESSION_KEYS = {
  PLAYER_ID: 'cc_player_id',
  PLAYER_NAME: 'cc_player_name',
  ROOM_CODE: 'cc_room_code'
};

/**
 * Generates a temporary random player ID.
 * @returns {string}
 */
export function generateTempPlayerId() {
  const rand = Math.random().toString(36).substring(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `player_${rand}${time}`;
}

/**
 * Gets or creates the session player ID.
 * @returns {string}
 */
export function getOrCreatePlayerId() {
  let id = sessionStorage.getItem(SESSION_KEYS.PLAYER_ID);
  if (!id) {
    id = generateTempPlayerId();
    sessionStorage.setItem(SESSION_KEYS.PLAYER_ID, id);
  }
  return id;
}

/**
 * Gets stored session data.
 */
export function getSessionData() {
  return {
    playerId: sessionStorage.getItem(SESSION_KEYS.PLAYER_ID) || null,
    playerName: sessionStorage.getItem(SESSION_KEYS.PLAYER_NAME) || '',
    roomCode: sessionStorage.getItem(SESSION_KEYS.ROOM_CODE) || ''
  };
}

/**
 * Saves session information.
 */
export function saveSessionData({ playerId, playerName, roomCode }) {
  if (playerId) sessionStorage.setItem(SESSION_KEYS.PLAYER_ID, playerId);
  if (playerName) sessionStorage.setItem(SESSION_KEYS.PLAYER_NAME, playerName);
  if (roomCode) sessionStorage.setItem(SESSION_KEYS.ROOM_CODE, roomCode.toUpperCase());
}

/**
 * Clears active room from session.
 */
export function clearSessionRoom() {
  sessionStorage.removeItem(SESSION_KEYS.ROOM_CODE);
}
