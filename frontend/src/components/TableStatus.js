import React from 'react';

const TableStatus = ({ currentTable, playerName, onStartGame, onLeaveTable, loading }) => {
  if (!currentTable) {
    return null;
  }

  const isOwner = currentTable.owner === playerName;
  const canStartGame = isOwner && currentTable.players.length >= 2;
  const isGameStarted = currentTable.status === 'active';

  const getStatusDisplay = () => {
    switch (currentTable.status) {
      case 'waiting':
        return (
          <div className="status-badge status-waiting">
            Waiting for players ({currentTable.players.length}/{currentTable.max_players})
          </div>
        );
      case 'active':
        return <div className="status-badge status-active">Game in progress</div>;
      case 'finished':
        return <div className="status-badge status-finished">Game finished</div>;
      default:
        return <div className="status-badge status-unknown">Unknown status</div>;
    }
  };

  return (
    <div className="table-status">
      <div className="table-header">
        <h3>Table: {currentTable.name}</h3>
        {getStatusDisplay()}
      </div>

      <div className="table-details">
        <div className="table-info">
          <p><strong>Table Code:</strong> {currentTable.invite_code}</p>
          <p><strong>Owner:</strong> {currentTable.owner}</p>
          <p><strong>Privacy:</strong> {currentTable.is_private ? 'Private' : 'Public'}</p>
        </div>

        {currentTable.invite_code && (
          <div className="invite-section">
            <p className="invite-label">Share this code with friends:</p>
            <div className="invite-code-display">
              <code className="invite-code">{currentTable.invite_code}</code>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => navigator.clipboard.writeText(currentTable.invite_code)}
                title="Copy invite code"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="table-actions">
        {!isGameStarted && (
          <>
            {isOwner && (
              <button
                className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
                onClick={onStartGame}
                disabled={!canStartGame || loading}
                title={!canStartGame ? 'Need at least 2 players to start' : ''}
              >
                {loading ? 'Starting...' : 'Start Game'}
              </button>
            )}
            <button
              className={`btn btn-secondary ${loading ? 'btn-loading' : ''}`}
              onClick={onLeaveTable}
              disabled={loading}
            >
              {loading ? 'Leaving...' : 'Leave Table'}
            </button>
          </>
        )}

        {isGameStarted && (
          <div className="game-status">
            <p>Game is in progress!</p>
            <button
              className="btn btn-primary"
              onClick={() => window.location.reload()}
            >
              Rejoin Game
            </button>
          </div>
        )}
      </div>

      {!canStartGame && !isGameStarted && (
        <div className="start-game-help">
          <p className="text-sm text-muted">
            {isOwner 
              ? `Need at least 2 players to start the game. Currently have ${currentTable.players.length} player(s).`
              : 'Waiting for the table owner to start the game.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default TableStatus;
