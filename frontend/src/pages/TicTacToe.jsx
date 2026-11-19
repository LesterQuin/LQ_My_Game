import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { ArrowLeft, RotateCcw, Bot, Users, Trophy, Sparkles, Zap, Shield } from 'lucide-react';

// Winning combinations for a 3x3 board
const WINNING_COMBOS = [
  [0, 1, 2], // rows
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6], // columns
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8], // diagonals
  [2, 4, 6]
];

/**
 * Checks if there's a winner or tie
 */
function checkWinner(board) {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { winner: 'TIE', line: null };
  }

  return null;
}

/**
 * Minimax Unbeatable AI Algorithm for Tic-Tac-Toe
 */
function minimax(board, depth, isMaximizing, aiSymbol, humanSymbol) {
  const result = checkWinner(board);
  if (result) {
    if (result.winner === aiSymbol) return 10 - depth;
    if (result.winner === humanSymbol) return depth - 10;
    if (result.winner === 'TIE') return 0;
  }

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = aiSymbol;
        const score = minimax(board, depth + 1, false, aiSymbol, humanSymbol);
        board[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = humanSymbol;
        const score = minimax(board, depth + 1, true, aiSymbol, humanSymbol);
        board[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

/**
 * Finds the optimal move for the AI
 */
function getBestAiMove(board, aiSymbol, humanSymbol, difficulty = 'impossible') {
  const availableMoves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) availableMoves.push(i);
  }

  // If difficulty is medium, 25% chance to make a random move
  if (difficulty === 'medium' && Math.random() < 0.25) {
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }

  // Minimax optimal move
  let bestScore = -Infinity;
  let move = availableMoves[0];

  for (const i of availableMoves) {
    board[i] = aiSymbol;
    const score = minimax(board, 0, false, aiSymbol, humanSymbol);
    board[i] = null;
    if (score > bestScore) {
      bestScore = score;
      move = i;
    }
  }

  return move;
}

export function TicTacToe() {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [mode, setMode] = useState('ai'); // 'ai' or 'local'
  const [difficulty, setDifficulty] = useState('impossible'); // 'impossible' or 'medium'
  const [scores, setScores] = useState({ x: 0, o: 0, ties: 0 });
  const [isAiThinking, setIsAiThinking] = useState(false);

  const gameResult = checkWinner(board);

  // Trigger confetti on win
  useEffect(() => {
    if (gameResult && gameResult.winner !== 'TIE') {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {}

      setScores((prev) => ({
        ...prev,
        [gameResult.winner.toLowerCase()]: prev[gameResult.winner.toLowerCase()] + 1
      }));
    } else if (gameResult && gameResult.winner === 'TIE') {
      setScores((prev) => ({
        ...prev,
        ties: prev.ties + 1
      }));
    }
  }, [gameResult?.winner]);

  // AI Move effect
  useEffect(() => {
    if (mode === 'ai' && !isXNext && !gameResult && !isAiThinking) {
      setIsAiThinking(true);

      const timer = setTimeout(() => {
        const aiMove = getBestAiMove(board, 'O', 'X', difficulty);
        if (aiMove !== undefined && board[aiMove] === null) {
          setBoard((prev) => {
            const next = [...prev];
            next[aiMove] = 'O';
            return next;
          });
          setIsXNext(true);
        }
        setIsAiThinking(false);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [mode, isXNext, board, gameResult, difficulty, isAiThinking]);

  // Player click handler
  const handleCellClick = (index) => {
    if (board[index] || gameResult || (mode === 'ai' && !isXNext) || isAiThinking) {
      return;
    }

    const currentSymbol = isXNext ? 'X' : 'O';
    const nextBoard = [...board];
    nextBoard[index] = currentSymbol;
    setBoard(nextBoard);
    setIsXNext(!isXNext);
  };

  // Reset round
  const handleRestart = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setIsAiThinking(false);
  };

  // Reset all scores
  const handleResetScores = () => {
    setScores({ x: 0, o: 0, ties: 0 });
    handleRestart();
  };

  return (
    <div className="panel" style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'center' }}>
      {/* Top Navigation */}
      <div style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
        <Link
          to="/"
          className="btn-subtle"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Games Hub</span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
        <Sparkles size={24} color="#2A9D8F" />
        <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: 0 }}>Tic-Tac-Toe</h2>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.5rem' }}>
        Classic 3x3 strategy. Challenge the smart AI or play with a friend!
      </p>

      {/* Mode Selector (1 Player vs AI / 2 Players) */}
      <div className="tictac-mode-pills">
        <button
          type="button"
          onClick={() => {
            setMode('ai');
            handleRestart();
          }}
          className={`tictac-mode-btn ${mode === 'ai' ? 'active' : ''}`}
        >
          <Bot size={16} />
          <span>1 Player (vs AI)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('local');
            handleRestart();
          }}
          className={`tictac-mode-btn ${mode === 'local' ? 'active' : ''}`}
        >
          <Users size={16} />
          <span>2 Players (Local)</span>
        </button>
      </div>

      {/* AI Difficulty Selector (Only shown in AI mode) */}
      {mode === 'ai' && (
        <div className="tictac-diff-toggle">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>AI Smartness:</span>
          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
            <button
              type="button"
              onClick={() => {
                setDifficulty('impossible');
                handleRestart();
              }}
              className={`tictac-diff-pill ${difficulty === 'impossible' ? 'active expert' : ''}`}
              title="Minimax AI: Never makes mistakes!"
            >
              <Zap size={13} />
              <span>Unbeatable AI</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDifficulty('medium');
                handleRestart();
              }}
              className={`tictac-diff-pill ${difficulty === 'medium' ? 'active casual' : ''}`}
              title="Occasional slip-ups for a fun casual match"
            >
              <Shield size={13} />
              <span>Smart AI</span>
            </button>
          </div>
        </div>
      )}

      {/* Score Board */}
      <div className="tictac-scoreboard">
        <div className={`score-card x-card ${isXNext && !gameResult ? 'turn' : ''}`}>
          <div className="score-label">Player (X)</div>
          <div className="score-val">{scores.x}</div>
        </div>

        <div className="score-card tie-card">
          <div className="score-label">Ties</div>
          <div className="score-val">{scores.ties}</div>
        </div>

        <div className={`score-card o-card ${!isXNext && !gameResult ? 'turn' : ''}`}>
          <div className="score-label">{mode === 'ai' ? 'Computer (O)' : 'Player (O)'}</div>
          <div className="score-val">{scores.o}</div>
        </div>
      </div>

      {/* Turn Status Banner */}
      <div className="tictac-turn-banner">
        {gameResult ? (
          gameResult.winner === 'TIE' ? (
            <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>🤝 It's a Draw!</span>
          ) : (
            <span style={{ color: gameResult.winner === 'X' ? '#D96B43' : '#2A9D8F', fontWeight: 800 }}>
              🎉 {mode === 'ai' && gameResult.winner === 'O' ? 'Computer Wins!' : `Player ${gameResult.winner} Wins!`}
            </span>
          )
        ) : isAiThinking ? (
          <span style={{ color: '#2A9D8F', fontWeight: 600 }}>🤖 Computer is thinking...</span>
        ) : (
          <span>
            Current Turn: <strong style={{ color: isXNext ? '#D96B43' : '#2A9D8F' }}>Player {isXNext ? 'X' : 'O'}</strong>
          </span>
        )}
      </div>

      {/* 3x3 Game Board Grid */}
      <div className="tictac-grid">
        {board.map((cell, index) => {
          const isWinningCell = gameResult?.line?.includes(index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => handleCellClick(index)}
              disabled={!!cell || !!gameResult || isAiThinking}
              className={`tictac-cell ${cell ? cell.toLowerCase() : ''} ${isWinningCell ? 'winning' : ''}`}
              aria-label={`Cell ${index + 1}`}
            >
              {cell}
            </button>
          );
        })}
      </div>

      {/* Action Controls */}
      <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center', marginTop: '1.75rem' }}>
        <button
          type="button"
          onClick={handleRestart}
          className="btn btn-primary"
          style={{ padding: '0.75rem 1.5rem', fontSize: '0.92rem' }}
        >
          <RotateCcw size={16} />
          <span>New Round</span>
        </button>

        <button
          type="button"
          onClick={handleResetScores}
          className="btn btn-outline"
          style={{ padding: '0.75rem 1.15rem', fontSize: '0.88rem' }}
        >
          <span>Reset Scores</span>
        </button>
      </div>
    </div>
  );
}
