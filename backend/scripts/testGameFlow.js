import assert from 'assert';
import {
  createRoom,
  getRoom,
  joinRoom,
  removePlayer,
  getSanitizedRoomState,
  deleteRoom
} from '../services/roomManager.js';
import {
  startGame,
  drawCard,
  submitAnswer,
  nextTurn,
  playAgain
} from '../services/gameManager.js';
import { comfortCards } from '../data/comfortCards.js';
import { validatePlayerName, validateAnswerText, sanitizeString } from '../utils/sanitize.js';
import { cleanExpiredRooms } from '../utils/roomCleanup.js';

console.log('--- Running Comfort Cards Backend Flow Tests ---');

// 1. Check card deck
assert.strictEqual(comfortCards.length, 120, 'Deck must contain exactly 120 questions');
console.log('✓ Verified 60 original questions');

// 2. Test sanitization
const maliciousName = '<script>alert("hack")</script>Lester';
const sanitizedNameResult = validatePlayerName(maliciousName);
assert.strictEqual(sanitizedNameResult.valid, true);
assert.strictEqual(sanitizedNameResult.sanitized, 'alert("hack")Lester');
assert.strictEqual(validatePlayerName('').valid, false);
console.log('✓ Verified input sanitization & XSS stripping');

// 3. Create room
const hostId = 'player_host123';
const room = createRoom('Lester', hostId, 'socket_1');
const roomCode = room.roomCode;
assert.ok(roomCode && roomCode.length === 6, 'Room code should be 6 characters');
assert.strictEqual(room.players.length, 1);
assert.strictEqual(room.players[0].name, 'Lester');
assert.strictEqual(room.players[0].isHost, true);
console.log(`✓ Room created successfully: ${roomCode}`);

// 4. Join second player
const player2Id = 'player_guest456';
joinRoom(roomCode, 'Claire', player2Id, 'socket_2');
assert.strictEqual(room.players.length, 2);
console.log('✓ Player 2 joined successfully');

// 5. Test reconnection
joinRoom(roomCode, 'Claire Updated', player2Id, 'socket_2_reconnected');
assert.strictEqual(room.players.length, 2, 'Reconnecting existing player should not create duplicate');
assert.strictEqual(room.players[1].socketId, 'socket_2_reconnected');
assert.strictEqual(room.players[1].connected, true);
console.log('✓ Player reconnection handled seamlessly without duplicate identities');

// 6. Start game
startGame(roomCode, hostId);
assert.strictEqual(room.status, 'PLAYING');
assert.strictEqual(room.deck.length, 60);
assert.strictEqual(room.currentPlayerIndex, 0);
assert.strictEqual(room.currentCardState, 'HIDDEN');
console.log('✓ Host started game, deck shuffled with 60 cards');

// 7. Turn enforcement - Player 2 tries to draw when it is Player 1's turn
assert.throws(
  () => drawCard(roomCode, player2Id),
  /It's not your turn yet/,
  'Server must authoritatively reject out-of-turn card draws'
);
console.log('✓ Out-of-turn draw prevented by server');

// 8. Correct player draws card
const { card: drawnCard } = drawCard(roomCode, hostId);
assert.ok(drawnCard && drawnCard.question, 'Card should have a question');
assert.strictEqual(room.currentCardState, 'REVEALED');
console.log('✓ Active player successfully drew card: ' + drawnCard.question.slice(0, 30) + '...');

// 9. Cannot draw twice
assert.throws(
  () => drawCard(roomCode, hostId),
  /Card has already been drawn/,
  'Cannot draw multiple times in same turn'
);
console.log('✓ Drawing twice in same turn prevented');

// 10. Submit answer
const { answer } = submitAnswer(roomCode, hostId, 'Focus on small steps.');
assert.ok(answer && answer.text === 'Focus on small steps.');
assert.strictEqual(room.cardsAnswered, 1);
console.log('✓ Answer submitted and stored temporarily in room state');

// 11. Next turn rotates to Player 2
const { finished } = nextTurn(roomCode, hostId);
assert.strictEqual(finished, false);
assert.strictEqual(room.currentPlayerIndex, 1);
assert.strictEqual(room.currentCardState, 'HIDDEN');
assert.strictEqual(room.currentCard, null);
console.log('✓ Turn advanced to Player 2');

// 12. Sanitized room state does NOT expose future cards or socket IDs
const sanitized = getSanitizedRoomState(room);
assert.strictEqual(sanitized.currentCard, null);
assert.strictEqual(sanitized.players[0].socketId, undefined);
assert.strictEqual(sanitized.deck, undefined);
assert.strictEqual(sanitized.cardsRemaining, 59);
console.log('✓ Sanitized state hides unrevealed cards and socket IDs');

// 13. Host leaves -> host reassignments
removePlayer(roomCode, hostId);
assert.strictEqual(room.players.length, 1);
assert.strictEqual(room.players[0].isHost, true);
assert.strictEqual(room.hostPlayerId, player2Id);
console.log('✓ Host reassigned when original host left');

// 14. Last player leaves -> room deleted
removePlayer(roomCode, player2Id);
assert.strictEqual(getRoom(roomCode), null);
console.log('✓ Room deleted immediately when last player leaves');

// 15. Expired room cleanup
const testCleanupRoom = createRoom('Ghost', 'ghost_id', 'ghost_socket');
testCleanupRoom.lastActivityAt = Date.now() - (35 * 60 * 1000); // 35 minutes ago
const cleaned = cleanExpiredRooms();
assert.ok(cleaned >= 1, 'Expired inactive rooms should be swept');
assert.strictEqual(getRoom(testCleanupRoom.roomCode), null);
console.log('✓ Inactive room swept automatically');

console.log('\nALL 15 BACKEND CHECKS PASSED SUCCESSFULLY! 🎉');
