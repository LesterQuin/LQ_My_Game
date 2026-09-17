import React from 'react';
import { User, Crown, WifiOff } from 'lucide-react';

export function PlayerList({ players = [], currentPlayerIndex, status }) {
  return (
    <div className="players-row">
      {players.map((player, index) => {
        const isCurrentTurn = status === 'PLAYING' && index === currentPlayerIndex;

        return (
          <div
            key={player.playerId}
            className={`player-chip ${isCurrentTurn ? 'active-turn' : ''} ${player.isHost ? 'is-host' : ''} ${!player.connected ? 'disconnected' : ''}`}
            title={!player.connected ? 'Temporarily disconnected' : ''}
          >
            {player.isHost ? (
              <Crown size={14} color="#D96B43" />
            ) : (
              <User size={14} />
            )}

            <span>{player.name}</span>

            {player.isHost && <span className="host-tag">HOST</span>}
            {!player.connected && <WifiOff size={12} color="#9B948D" />}
          </div>
        );
      })}
    </div>
  );
}
