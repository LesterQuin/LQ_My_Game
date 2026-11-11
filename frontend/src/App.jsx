import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Header } from './components/Header.jsx';
import { Toast } from './components/Toast.jsx';
import { Home } from './pages/Home.jsx';
import { CreateGame } from './pages/CreateGame.jsx';
import { JoinGame } from './pages/JoinGame.jsx';
import { Lobby } from './pages/Lobby.jsx';
import { Game } from './pages/Game.jsx';
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
  setDeckSize
}) {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roomState && roomCode) {
      // If room state isn't loaded (e.g. direct link), redirect to join page
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
      />
    );
  }

  return (
    <Game
      roomState={roomState}
      playerId={playerId}
      onNextQuestion={nextQuestion}
      onPlayAgain={playAgain}
      onLeaveRoom={handleLeave}
      reactions={reactions}
      onSendReaction={sendReaction}
    />
  );
}

function MainApp() {
  const {
    roomState,
    toastMessage,
    reactions,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    nextQuestion,
    playAgain,
    sendReaction,
    setDeckSize
  } = useGameSocket();

  const { playerId } = getSessionData();
  const navigate = useNavigate();

  const handleLeave = async () => {
    await leaveRoom();
    navigate('/');
  };

  return (
    <div className="app-container">
      <Header roomCode={roomState?.roomCode} onLeave={handleLeave} />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateGame onCreateRoom={createRoom} />} />
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
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Toast toast={toastMessage} />
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
