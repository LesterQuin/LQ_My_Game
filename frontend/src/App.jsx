import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Header } from './components/Header.jsx';
import { Toast } from './components/Toast.jsx';
import { Home } from './pages/Home.jsx';
import { CreateGame } from './pages/CreateGame.jsx';
import { JoinGame } from './pages/JoinGame.jsx';
import { Lobby } from './pages/Lobby.jsx';
import { Game } from './pages/Game.jsx';
import { DrawGame } from './pages/DrawGame.jsx';
import { TicTacToe } from './pages/TicTacToe.jsx';
import { useGameSocket } from './hooks/useGameSocket.js';
import { getSessionData } from './utils/session.js';

function RoomRoute({
  roomState,
  playerId,
  leaveRoom,
  startGame,
  nextQuestion,
  playAgain,
  reactions,
  sendReaction,
  setDeckSize,
  setRounds,
  setRoundDuration,
  setCategory,
  selectWord,
  sendDrawSegment,
  clearCanvas,
  undoStroke,
  submitGuess,
  giveHint,
  sendChatMessage
}) {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomState && roomCode) {
      navigate(`/join/${roomCode}`);
    }
  }, [roomState, roomCode, navigate]);

  if (!roomState) {
    return (
      <div className="panel" style={{ maxWidth: '380px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Connecting to room...</p>
      </div>
    );
  }

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/');
  };

  if (roomState.status === 'LOBBY') {
    return (
      <Lobby
        roomState={roomState}
        playerId={playerId}
        onStartGame={startGame}
        onLeaveRoom={handleLeave}
        onSetDeckSize={setDeckSize}
        onSetRounds={setRounds}
        onSetRoundDuration={setRoundDuration}
        onSetCategory={setCategory}
      />
    );
  }

  // Draw & Guess game mode
  if (roomState.gameType === 'DRAW_AND_GUESS') {
    return (
      <DrawGame
        roomState={roomState}
        playerId={playerId}
        onSelectWord={selectWord}
        onDrawSegment={sendDrawSegment}
        onClearCanvas={clearCanvas}
        onUndoStroke={undoStroke}
        onSubmitGuess={submitGuess}
        onGiveHint={giveHint}
        onPlayAgain={playAgain}
        onLeaveRoom={handleLeave}
      />
    );
  }

  // Comfort Cards conversation game mode
  return (
    <Game
      roomState={roomState}
      playerId={playerId}
      onNextQuestion={nextQuestion}
      onPlayAgain={playAgain}
      onLeaveRoom={handleLeave}
      reactions={reactions}
      onSendReaction={sendReaction}
      onSendChatMessage={sendChatMessage}
    />
  );
}

function MainApp() {
  const {
    roomState,
    toastMessage,
    clearToast,
    reactions,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    nextQuestion,
    playAgain,
    sendReaction,
    setDeckSize,
    setRounds,
    setRoundDuration,
    setCategory,
    selectWord,
    sendDrawSegment,
    clearCanvas,
    undoStroke,
    submitGuess,
    giveHint,
    sendChatMessage
  } = useGameSocket();

  const { playerId } = getSessionData();
  const navigate = useNavigate();
  const location = useLocation();

  // If user navigates away from the active room (e.g. back to home, create, or tic-tac-toe),
  // immediately clean up the room session, stop all background game timers, and clear toasts.
  useEffect(() => {
    if (!location.pathname.startsWith('/room')) {
      if (roomState) {
        leaveRoom();
      }
      if (clearToast) {
        clearToast();
      }
    }
  }, [location.pathname, roomState, leaveRoom, clearToast]);

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/');
  };

  return (
    <div className="app-container">
      <Header roomCode={roomState?.roomCode} gameType={roomState?.gameType} onLeave={handleLeave} />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateGame onCreateRoom={createRoom} />} />
          <Route path="/tictactoe" element={<TicTacToe />} />
          <Route path="/join" element={<JoinGame onJoinRoom={joinRoom} />} />
          <Route path="/join/:initialCode" element={<JoinGame onJoinRoom={joinRoom} />} />
          <Route
            path="/room/:roomCode"
            element={
              <RoomRoute
                roomState={roomState}
                playerId={playerId}
                leaveRoom={leaveRoom}
                startGame={startGame}
                nextQuestion={nextQuestion}
                playAgain={playAgain}
                reactions={reactions}
                sendReaction={sendReaction}
                setDeckSize={setDeckSize}
                setRounds={setRounds}
                setRoundDuration={setRoundDuration}
                setCategory={setCategory}
                selectWord={selectWord}
                sendDrawSegment={sendDrawSegment}
                clearCanvas={clearCanvas}
                undoStroke={undoStroke}
                submitGuess={submitGuess}
                giveHint={giveHint}
                sendChatMessage={sendChatMessage}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Only display room toasts (hints, guesses) while actively inside a room */}
      {location.pathname.startsWith('/room') && <Toast toast={toastMessage} />}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <MainApp />
    </HashRouter>
  );
}
