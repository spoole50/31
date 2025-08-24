import React from 'react';

const CurrentTableView = ({ 
  table, 
  playerId, 
  playerName,
  onStartGame, 
  onLeaveTable, 
  onAddAI,
  onGameStart,
  loading 
}) => {
  // Add null check to prevent errors
  if (!table) {
    return (
      <div className="current-table loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading table...</p>
        </div>
      </div>
    );
  }

  const isOwner = table.host_id === playerId;
  const playerCount = table.players.length;
  const canStartGame = isOwner && table.status === 'waiting' && playerCount >= 2;
  const canAddAI = isOwner && table.status === 'waiting' && playerCount < table.max_players;
  const isGameReady = table.status === 'playing';

  const handleStartGame = async () => {
    try {
      await onStartGame();
    } catch (error) {
      // Error is handled by parent component
    }
  };

  const handleAddAI = async (difficulty) => {
    try {
      await onAddAI(difficulty);
    } catch (error) {
      // Error is handled by parent component
    }
  };

  const handleGameStart = () => {
    onGameStart(table.table_id, playerId, playerName);
  };

  if (isGameReady) {
    return (
      <div className="current-table game-ready">
        <div className="game-ready-card">
          <div className="game-ready-icon">🎮</div>
          <h3>Game is Ready!</h3>
          <p>All players have joined. The game is about to begin!</p>
          <button 
            className="btn btn-success btn-lg enter-game-btn"
            onClick={handleGameStart}
          >
            <span>🚀</span>
            Enter Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="current-table">
      <div className="table-header">
        <div className="table-title-section">
          <h3 className="table-title">{table.table_name}</h3>
          <div className="table-meta">
            <span className={`status-badge status-${table.status}`}>
              {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
            </span>
            <span className="invite-code-badge">
              <span className="code-label">Invite Code:</span>
              <code className="invite-code">{table.invite_code}</code>
            </span>
          </div>
        </div>
        <button 
          className="btn btn-outline-danger btn-sm leave-table-btn"
          onClick={onLeaveTable}
          disabled={loading}
        >
          <span>🚪</span>
          Leave Table
        </button>
      </div>

      <div className="table-stats">
        <div className="stat-item">
          <span className="stat-icon">👥</span>
          <span className="stat-label">Players</span>
          <span className="stat-value">{playerCount}/{table.max_players}</span>
        </div>
        <div className="stat-item">
          <span className="stat-icon">👑</span>
          <span className="stat-label">Host</span>
          <span className="stat-value">{table.players.find(p => p.id === table.host_id)?.name || 'Unknown'}</span>
        </div>
        {table.is_private && (
          <div className="stat-item">
            <span className="stat-icon">🔒</span>
            <span className="stat-label">Access</span>
            <span className="stat-value">Private</span>
          </div>
        )}
      </div>

      <div className="players-section">
        <div className="players-header">
          <h4>Players ({playerCount}/{table.max_players})</h4>
          {canAddAI && (
            <div className="ai-controls">
              <span className="ai-label">Add AI:</span>
              <button 
                className="btn btn-ai btn-sm"
                onClick={() => handleAddAI('easy')}
                disabled={loading}
                title="Add Easy AI"
              >
                🤖 Easy
              </button>
              <button 
                className="btn btn-ai btn-sm"
                onClick={() => handleAddAI('medium')}
                disabled={loading}
                title="Add Medium AI"
              >
                🤖 Medium
              </button>
              <button 
                className="btn btn-ai btn-sm"
                onClick={() => handleAddAI('hard')}
                disabled={loading}
                title="Add Hard AI"
              >
                🤖 Hard
              </button>
            </div>
          )}
        </div>
        
        <div className="players-grid">
          {table.players.map(player => (
            <PlayerCard 
              key={player.id} 
              player={player} 
              isOwner={player.id === table.host_id}
              isCurrentPlayer={player.id === playerId}
            />
          ))}
          
          {/* Empty slots */}
          {Array.from({ length: table.max_players - playerCount }, (_, index) => (
            <EmptyPlayerSlot 
              key={`empty-${index}`} 
              showAddAI={canAddAI && index === 0}
              onAddAI={handleAddAI}
              loading={loading}
            />
          ))}
        </div>
      </div>

      <div className="table-actions">
        {canStartGame && (
          <div className="start-game-section">
            <button 
              className={`btn btn-success btn-lg start-game-btn ${loading ? 'btn-loading' : ''}`}
              onClick={handleStartGame}
              disabled={loading}
            >
              <span>🎮</span>
              Start Game ({playerCount} players)
            </button>
            <p className="game-info">
              You can start with {playerCount} players or add more players/AI
            </p>
          </div>
        )}

        {!canStartGame && table.status === 'waiting' && (
          <div className="waiting-section">
            {isOwner ? (
              <div className="waiting-host">
                <p className="waiting-message">
                  <span>⏳</span>
                  Need at least 2 players to start the game
                </p>
                {playerCount < 2 && (
                  <p className="suggestion">
                    Share the invite code <code>{table.invite_code}</code> with friends or add AI players above
                  </p>
                )}
              </div>
            ) : (
              <div className="waiting-player">
                <p className="waiting-message">
                  <span>⏳</span>
                  Waiting for the host to start the game...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PlayerCard = ({ player, isOwner, isCurrentPlayer }) => {
  const isAI = player.is_ai;
  const aiDifficulty = player.ai_difficulty;
  
  return (
    <div className={`player-card ${isCurrentPlayer ? 'current-player' : ''} ${isAI ? 'ai-player' : 'human-player'}`}>
      <div className="player-avatar">
        {isAI ? (
          <span className="ai-avatar">🤖</span>
        ) : (
          <span className="human-avatar">{player.name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="player-info">
        <div className="player-name">
          {player.name}
          {isCurrentPlayer && <span className="you-badge">(You)</span>}
        </div>
        <div className="player-badges">
          {isOwner && <span className="badge badge-owner">👑 Host</span>}
          {isAI && <span className="badge badge-ai">🤖 {aiDifficulty}</span>}
          {!isAI && <span className="badge badge-human">👤 Human</span>}
        </div>
      </div>
      <div className="player-status">
        <span className="status-indicator ready"></span>
      </div>
    </div>
  );
};

const EmptyPlayerSlot = ({ showAddAI, onAddAI, loading }) => {
  return (
    <div className="player-card empty-slot">
      <div className="player-avatar empty">
        <span className="empty-avatar">+</span>
      </div>
      <div className="player-info">
        <div className="player-name empty">
          {showAddAI ? 'Add Player or AI' : 'Waiting for player...'}
        </div>
        {showAddAI && (
          <div className="empty-slot-actions">
            <button 
              className="btn btn-ai-mini"
              onClick={() => onAddAI('medium')}
              disabled={loading}
              title="Add AI Player"
            >
              + AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrentTableView;
