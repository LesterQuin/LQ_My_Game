import { useState, useEffect, useCallback } from 'react';
import { peerManager } from '../services/peerService.js';
import {
  getOrCreatePlayerId,
  saveSessionData,
  getSessionData,
  clearSessionRoom
} from '../utils/session.js';

export function useGameSocket() {
  const [roomState, setRoomState] = useState(null);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [reactions, setReactions] = useState([]);

  const addReaction = useCallback((reaction) => {
    setReactions((prev) => [...prev.slice(-15), reaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
    }, 2800);
  }, []);

  const showToast = useCallback((msg, type = 'info') => {
    setToastMessage({ message: msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  const createRoom = useCallback(
    async ({
      name,
      maxPlayers = 6,
      gameType = 'CARDS',
      deckSize = 30,
      totalRounds = 5,
      roundDuration = 60,
      selectedCategory = 'ALL'
    }) => {
      try {
        const res = await peerManager.createRoom({
          name,
          maxPlayers,
          gameType,
          deckSize,
          totalRounds,
          roundDuration,
          selectedCategory,
          onStateChange: (state) => setRoomState(state),
          onError: (err) => {
            setError(err);
            showToast(err, 'error');
          },
          onToast: (msg) => showToast(msg),
          onReaction: (rx) => addReaction(rx)
        });

        saveSessionData({
          playerId: res.playerId,
          playerName: name,
          roomCode: res.roomCode
        });

        setRoomState(res.roomState);
        return res;
      } catch (err) {
        throw err;
      }
    },
    [showToast, addReaction]
  );

  const joinRoom = useCallback(
    async (roomCode, name) => {
      try {
        const playerId = getOrCreatePlayerId();
        const res = await peerManager.joinRoom({
          roomCode,
          name,
          playerId,
          onStateChange: (state) => setRoomState(state),
          onError: (err) => {
            setError(err);
            showToast(err, 'error');
          },
          onToast: (msg) => showToast(msg),
          onReaction: (rx) => addReaction(rx)
        });

        saveSessionData({
          playerId: res.playerId,
          playerName: name,
          roomCode: res.roomCode
        });

        setRoomState(res.roomState);
        return res;
      } catch (err) {
        throw err;
      }
    },
    [showToast, addReaction]
  );

  const leaveRoom = useCallback(async () => {
    peerManager.destroy();
    clearSessionRoom();
    setRoomState(null);
    setReactions([]);
  }, []);

  const startGame = useCallback(async () => {
    try {
      if (roomState?.gameType === 'DRAW_AND_GUESS') {
        peerManager.startDrawGame();
      } else {
        peerManager.startGame();
      }
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  }, [roomState?.gameType, showToast]);

  const nextQuestion = useCallback(async () => {
    peerManager.nextQuestion();
  }, []);

  const playAgain = useCallback(async () => {
    if (roomState?.gameType === 'DRAW_AND_GUESS') {
      peerManager.playAgainDrawGame();
    } else {
      peerManager.playAgain();
    }
  }, [roomState?.gameType]);

  const sendReaction = useCallback((emoji) => {
    peerManager.sendReaction(emoji);
  }, []);

  const setDeckSize = useCallback((deckSize) => {
    peerManager.setDeckSize(deckSize);
  }, []);

  const setGameType = useCallback((gameType) => {
    peerManager.setGameType(gameType);
  }, []);

  const setRounds = useCallback((rounds) => {
    peerManager.setRounds(rounds);
  }, []);

  const setRoundDuration = useCallback((duration) => {
    peerManager.setRoundDuration(duration);
  }, []);

  const setCategory = useCallback((category) => {
    peerManager.setCategory(category);
  }, []);

  const selectWord = useCallback((word) => {
    peerManager.selectWord(word);
  }, []);

  const sendDrawSegment = useCallback((segment) => {
    peerManager.sendDrawSegment(segment);
  }, []);

  const clearCanvas = useCallback(() => {
    peerManager.clearCanvas();
  }, []);

  const undoStroke = useCallback(() => {
    peerManager.undoStroke();
  }, []);

  const submitGuess = useCallback((guess) => {
    peerManager.submitGuess(guess);
  }, []);

  const giveHint = useCallback(() => {
    peerManager.giveHint();
  }, []);

  return {
    roomState,
    error,
    toastMessage,
    showToast,
    reactions,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    nextQuestion,
    playAgain,
    sendReaction,
    setDeckSize,
    setGameType,
    setRounds,
    setRoundDuration,
    setCategory,
    selectWord,
    sendDrawSegment,
    clearCanvas,
    undoStroke,
    submitGuess,
    giveHint
  };
}
