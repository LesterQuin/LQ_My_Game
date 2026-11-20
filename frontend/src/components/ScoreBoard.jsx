import React from 'react';
import { Trophy, Edit3, CheckCircle, Crown } from 'lucide-react';

export function ScoreBoard({
  players = [],
  currentDrawerId = null,
  currentUserId = null
}) {
  // Sort players descending by score
  const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div className="draw-scoreboard">
      <div className="scoreboard-title">
        <Trophy size={16} color="var(--accent-terracotta)" />
        <span>Leaderboard</span>
      </div>

      <div className="scoreboard-list">
        {sorted.map((player, index) => {
          const isDrawer = player.playerId === currentDrawerId;
          const isMe = player.playerId === currentUserId;
          const hasGuessed = !!player.hasGuessed;

          return (
            <div
              key={player.playerId}
              className={`scoreboard-item rank-${index + 1} ${isMe ? 'is-me' : ''} ${hasGuessed ? 'has-guessed' : ''}`}
            >
              <div className="scoreboard-rank">#{index + 1}</div>

              <div className="scoreboard-player-info">
                <span className="scoreboard-name">
                  {player.name} {isMe ? '(You)' : ''}
                </span>

                <div className="scoreboard-badges">
                  {player.isHost && (
                    <span className="mini-badge host" title="Room Host">
                      <Crown size={11} />
                    </span>
                  )}
                  {isDrawer && (
                    <span className="mini-badge drawing" title="Currently Drawing">
                      <Edit3 size={11} />
                      <span>Drawing</span>
                    </span>
                  )}
                  {hasGuessed && !isDrawer && (
                    <span className="mini-badge guessed" title="Guessed the word!">
                      <CheckCircle size={11} />
                      <span>Guessed</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="scoreboard-score">
                <span className="score-num">{player.score || 0}</span>
                <span className="score-pts">pts</span>
                {player.roundScore > 0 && (
                  <span className="score-round-bonus" title={`+${player.roundScore} pts this round`}>
                    +{player.roundScore}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
