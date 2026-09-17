// Characters excluding visually ambiguous ones: 0, O, 1, I, L
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

/**
 * Generates a random 6-character room code.
 * @returns {string}
 */
export function generateRoomCode() {
  let result = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * CHARSET.length);
    result += CHARSET[randomIndex];
  }
  return result;
}

/**
 * Normalizes and validates a room code string.
 * @param {string} code
 * @returns {string}
 */
export function normalizeRoomCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Validates if room code matches the expected format.
 * @param {string} code
 * @returns {boolean}
 */
export function isValidRoomCode(code) {
  const normalized = normalizeRoomCode(code);
  return normalized.length === CODE_LENGTH;
}
