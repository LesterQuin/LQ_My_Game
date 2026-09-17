import { getRoom, touchRoom } from './roomManager.js';
import { comfortCards } from '../data/comfortCards.js';
import { shuffleArray } from '../utils/shuffle.js';
import { validateAnswerText } from '../utils/sanitize.js';

/**
 * Starts a game for a room.
 * Authoritatively validates host status, shuffles deck, sets turn 0.
 * @param {string} roomCode
 * @param {string} playerId
 * @returns {object} Updated room
 */
export function startGame(roomCode, playerId) {
  const room = getRoom(roomCode);
  if (!room) {
    throw new Error('Room not found.');
  }

  if (room.hostPlayerId !== playerId) {
    throw new Error('Only the host can start the game.');
  }

  if (room.players.length === 0) {
    throw new Error('Cannot start a game with no players.');
  }

  if (room.status === 'PLAYING') {
    throw new Error('Game is already in progress.');
  }

  // Shuffle 60 original questions
  const shuffledDeck = shuffleArray(comfortCards);

  room.deck = shuffledDeck;
  room.currentCardIndex = 0;
  room.currentPlayerIndex = 0;
  room.currentCardState = 'HIDDEN';
  room.currentCard = null;
  room.currentAnswer = null;
  room.cardsAnswered = 0;
  room.status = 'PLAYING';
  touchRoom(roomCode);

  return room;
}

/**
 * Authoritatively draws the current card for the active player.
 * @param {string} roomCode
 * @param {string} playerId
 * @returns {{ room: object, card: object }}
 */
export function drawCard(roomCode, playerId) {
  const room = getRoom(roomCode);
  if (!room) {
    throw new Error('Room not found.');
  }

  if (room.status !== 'PLAYING') {
    throw new Error('Game is not currently active.');
  }

  const currentPlayer = room.players[room.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    throw new Error("It's not your turn yet.");
  }

  if (room.currentCardState === 'REVEALED') {
    throw new Error('Card has already been drawn for this turn.');
  }

  if (room.currentCardIndex >= room.deck.length) {
    room.status = 'FINISHED';
    touchRoom(roomCode);
    return { room, card: null };
  }

  const drawnCard = room.deck[room.currentCardIndex];
  room.currentCard = drawnCard;
  room.currentCardState = 'REVEALED';
  room.currentAnswer = null; // Clear previous round answer
  touchRoom(roomCode);

  return { room, card: drawnCard };
}

/**
 * Submits an answer for the current revealed card.
 * Temporary only - stored in in-memory room state for the round.
 * @param {string} roomCode
 * @param {string} playerId
 * @param {string} answerText
 * @returns {{ room: object, answer: object }}
 */
export function submitAnswer(roomCode, playerId, answerText) {
  const room = getRoom(roomCode);
  if (!room) {
    throw new Error('Room not found.');
  }

  if (room.status !== 'PLAYING') {
    throw new Error('Game is not currently active.');
  }

  const currentPlayer = room.players[room.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.playerId !== playerId) {
    throw new Error("It's not your turn to answer.");
  }

  if (room.currentCardState !== 'REVEALED') {
    throw new Error('Please draw a card before answering.');
  }

  const validation = validateAnswerText(answerText);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const answer = {
    playerId,
    playerName: currentPlayer.name,
    text: validation.sanitized,
    timestamp: Date.now()
  };

  room.currentAnswer = answer;
  room.cardsAnswered += 1;
  touchRoom(roomCode);

  return { room, answer };
}

/**
 * Advances turn to the next player and moves to the next card.
 * @param {string} roomCode
 * @param {string} playerId
 * @returns {{ room: object, finished: boolean }}
 */
export function nextTurn(roomCode, playerId) {
  const room = getRoom(roomCode);
  if (!room) {
    throw new Error('Room not found.');
  }

  if (room.status !== 'PLAYING') {
    throw new Error('Game is not currently active.');
  }

  const currentPlayer = room.players[room.currentPlayerIndex];
  // Allow the current player or the host to advance the turn
  const isCurrentPlayer = currentPlayer && currentPlayer.playerId === playerId;
  const isHost = room.hostPlayerId === playerId;

  if (!isCurrentPlayer && !isHost) {
    throw new Error('Only the current player or host can advance to the next turn.');
  }

  // Move to next card index
  room.currentCardIndex += 1;

  // Check if deck finished
  if (room.currentCardIndex >= room.deck.length) {
    room.status = 'FINISHED';
    room.currentCardState = 'HIDDEN';
    room.currentCard = null;
    touchRoom(roomCode);
    return { room, finished: true };
  }

  // Advance player turn (round-robin)
  if (room.players.length > 0) {
    room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  } else {
    room.currentPlayerIndex = 0;
  }

  room.currentCardState = 'HIDDEN';
  room.currentCard = null;
  touchRoom(roomCode);

  return { room, finished: false };
}

/**
 * Resets the room and starts a brand-new game session.
 * @param {string} roomCode
 * @param {string} playerId
 * @returns {object} Updated room
 */
export function playAgain(roomCode, playerId) {
  const room = getRoom(roomCode);
  if (!room) {
    throw new Error('Room not found.');
  }

  // Reshuffle deck
  const shuffledDeck = shuffleArray(comfortCards);

  room.deck = shuffledDeck;
  room.currentCardIndex = 0;
  room.currentPlayerIndex = 0;
  room.currentCardState = 'HIDDEN';
  room.currentCard = null;
  room.currentAnswer = null;
  room.cardsAnswered = 0;
  room.status = 'PLAYING';
  touchRoom(roomCode);

  return room;
}
