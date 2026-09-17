/**
 * Strips HTML tags and controls characters.
 * @param {string} str
 * @returns {string}
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/<[^>]*>/g, '') // remove HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // remove ASCII control characters
    .trim();
}

/**
 * Validates and sanitizes a player nickname.
 * @param {string} name
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validatePlayerName(name) {
  const sanitized = sanitizeString(name);
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, sanitized: '', error: 'Your name is required.' };
  }
  if (sanitized.length > 25) {
    return { valid: false, sanitized: '', error: 'Name must be 25 characters or fewer.' };
  }
  return { valid: true, sanitized };
}

/**
 * Validates and sanitizes a player's temporary answer.
 * @param {string} text
 * @returns {{ valid: boolean, sanitized: string, error?: string }}
 */
export function validateAnswerText(text) {
  const sanitized = sanitizeString(text);
  if (!sanitized || sanitized.length === 0) {
    return { valid: false, sanitized: '', error: 'Answer cannot be empty.' };
  }
  if (sanitized.length > 500) {
    return { valid: false, sanitized: '', error: 'Answer must be 500 characters or fewer.' };
  }
  return { valid: true, sanitized };
}

/**
 * Generates a random temporary player ID.
 * @returns {string}
 */
export function generatePlayerId() {
  const rand = Math.random().toString(36).substring(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `player_${rand}${time}`;
}
