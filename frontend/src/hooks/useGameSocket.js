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
    async ({ name, maxPlayers = 6, deckSize = 30 }) => {
      try {
        const res = await peerManager.createRoom({
          name,
          maxPlayers,
          deckSize,
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
      peerManager.startGame();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  }, [showToast]);

  const nextQuestion = useCallback(async () => {
    peerManager.nextQuestion();
  }, []);

  const playAgain = useCallback(async () => {
    peerManager.playAgain();
  }, []);

  const sendReaction = useCallback((emoji) => {
    peerManager.sendReaction(emoji);
  }, []);

  const setDeckSize = useCallback((deckSize) => {
    peerManager.setDeckSize(deckSize);
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
    setDeckSize
  };
}
