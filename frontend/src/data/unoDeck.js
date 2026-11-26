/**
 * Uno Cards Deck Engine & Utilities
 * 108 Cards:
 * - Colors: RED, BLUE, GREEN, YELLOW
 * - Numbers: 0 (1 per color), 1-9 (2 per color)
 * - Actions: SKIP, REVERSE, DRAW_TWO (2 per color)
 * - Wilds: WILD, WILD_DRAW_FOUR (4 of each, color WILD initially)
 */

export const UNO_COLORS = ['RED', 'BLUE', 'GREEN', 'YELLOW'];

export const COLOR_CONFIG = {
  RED: { name: 'Red', hex: '#EF4444', bg: '#FEE2E2', border: '#DC2626' },
  BLUE: { name: 'Blue', hex: '#3B82F6', bg: '#DBEAFE', border: '#2563EB' },
  GREEN: { name: 'Green', hex: '#10B981', bg: '#D1FAE5', border: '#059669' },
  YELLOW: { name: 'Yellow', hex: '#F59E0B', bg: '#FEF3C7', border: '#D97706' },
  WILD: { name: 'Wild', hex: '#1F2937', bg: '#F3F4F6', border: '#111827' }
};

export const CARD_TYPES = {
  NUMBER: 'NUMBER',
  SKIP: 'SKIP',
  REVERSE: 'REVERSE',
  DRAW_TWO: 'DRAW_TWO',
  WILD: 'WILD',
  WILD_DRAW_FOUR: 'WILD_DRAW_FOUR'
};

/**
 * Creates a standard 108-card Uno deck.
 */
export function createUnoDeck() {
  const deck = [];
  let idCounter = 1;

  for (const color of UNO_COLORS) {
    // 1 zero per color
    deck.push({
      id: `c_${idCounter++}`,
      color,
      type: CARD_TYPES.NUMBER,
      value: 0,
      label: '0'
    });

    // 2 of each number 1-9 per color
    for (let val = 1; val <= 9; val++) {
      for (let count = 0; count < 2; count++) {
        deck.push({
          id: `c_${idCounter++}`,
          color,
          type: CARD_TYPES.NUMBER,
          value: val,
          label: String(val)
        });
      }
    }

    // 2 Skips per color
    for (let count = 0; count < 2; count++) {
      deck.push({
        id: `c_${idCounter++}`,
        color,
        type: CARD_TYPES.SKIP,
        label: '⊘'
      });
    }

    // 2 Reverses per color
    for (let count = 0; count < 2; count++) {
      deck.push({
        id: `c_${idCounter++}`,
        color,
        type: CARD_TYPES.REVERSE,
        label: '⇄'
      });
    }

    // 2 Draw Twos (+2) per color
    for (let count = 0; count < 2; count++) {
      deck.push({
        id: `c_${idCounter++}`,
        color,
        type: CARD_TYPES.DRAW_TWO,
        label: '+2'
      });
    }
  }

  // 4 Wild cards
  for (let count = 0; count < 4; count++) {
    deck.push({
      id: `c_${idCounter++}`,
      color: 'WILD',
      type: CARD_TYPES.WILD,
      label: '★'
    });
  }

  // 4 Wild Draw Four cards (+4)
  for (let count = 0; count < 4; count++) {
    deck.push({
      id: `c_${idCounter++}`,
      color: 'WILD',
      type: CARD_TYPES.WILD_DRAW_FOUR,
      label: '+4'
    });
  }

  return shuffleDeck(deck);
}

/**
 * Fisher-Yates array shuffler.
 */
export function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Checks if a card is legally playable on top of current discard card and active color.
 * Supports Plus Card Stacking (+2 / +4).
 * @param {Object} cardToPlay
 * @param {Object} topCard
 * @param {string} activeColor - Effective color (especially if topCard is Wild)
 * @param {number} pendingDrawCount - Accumulated draw penalty stack
 */
export function canPlayCard(cardToPlay, topCard, activeColor, pendingDrawCount = 0) {
  if (!cardToPlay || !topCard) return false;

  // Plus Stacking Rule: If there is an active + penalty stack, player MUST drop a matching plus card (+2 / +4)
  if (pendingDrawCount > 0) {
    if (topCard.type === CARD_TYPES.DRAW_TWO) {
      // On +2, you can drop any color +2, or a Wild +4
      return cardToPlay.type === CARD_TYPES.DRAW_TWO || cardToPlay.type === CARD_TYPES.WILD_DRAW_FOUR;
    }
    if (topCard.type === CARD_TYPES.WILD_DRAW_FOUR) {
      // On +4, you can drop another Wild +4
      return cardToPlay.type === CARD_TYPES.WILD_DRAW_FOUR;
    }
    return false;
  }

  // Wild cards can always be played
  if (cardToPlay.color === 'WILD' || cardToPlay.type === CARD_TYPES.WILD || cardToPlay.type === CARD_TYPES.WILD_DRAW_FOUR) {
    return true;
  }

  const effectiveColor = activeColor || topCard.color;

  // Match by color
  if (cardToPlay.color === effectiveColor) {
    return true;
  }

  // Match by type / symbol / value
  if (cardToPlay.type === CARD_TYPES.NUMBER && topCard.type === CARD_TYPES.NUMBER) {
    return cardToPlay.value === topCard.value;
  }

  // Match action card types (e.g. Skip on Skip, +2 on +2, Reverse on Reverse)
  if (cardToPlay.type !== CARD_TYPES.NUMBER && cardToPlay.type === topCard.type) {
    return true;
  }

  return false;
}
