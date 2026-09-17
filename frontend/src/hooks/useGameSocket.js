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

  const showToast = useCallback((msg, type = 'info') => {
    setToastMessage({ message: msg, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  const createRoom = useCallback(
    async ({ name, maxPlayers = 6 }) => {
      try {
        const res = await peerManager.createRoom({
          name,
          maxPlayers,
          onStateChange: (state) => setRoomState(state),
          onError: (err) => {
            setError(err);
            showToast(err, 'error');
          },
          onToast: (msg) => showToast(msg)
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
    [showToast]
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
          onToast: (msg) => showToast(msg)
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
    [showToast]
  );

  const leaveRoom = useCallback(async () => {
    peerManager.destroy();
    clearSessionRoom();
    setRoomState(null);
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

  return {
    roomState,
    error,
    toastMessage,
    showToast,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    nextQuestion,
    playAgain
  };
}
