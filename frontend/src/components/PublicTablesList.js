import React from 'react';

const PublicTablesList = ({ tables, onJoinTable, loading }) => {
  if (loading) {
    return (
      <div className="loading">
        Loading tables...
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="empty-state text-center p-4">
        <p className="text-muted">No public tables available</p>
        <p className="text-sm">Create a new table to get started!</p>
      </div>
    );
  }

  return (
    <div className="tables-list">
      <h3>Available Tables</h3>
      <div className="tables-grid">
        {tables.map(table => (
          <TableCard 
            key={table.table_id} 
            table={table} 
            onJoin={onJoinTable}
          />
        ))}
      </div>
    </div>
  );
};

const TableCard = ({ table, onJoin }) => {
  const handleJoin = () => {
    onJoin(table.table_id, table.password_protected ? 'password-required' : '');
  };

  const getStatusBadge = () => {
    switch (table.status) {
      case 'waiting':
        return <span className="badge badge-warning">Waiting</span>;
      case 'playing':
        return <span className="badge badge-success">Playing</span>;
      case 'finished':
        return <span className="badge badge-secondary">Finished</span>;
      default:
        return <span className="badge badge-light">{table.status}</span>;
    }
  };

  const isJoinable = table.status === 'waiting' && table.players.length < table.max_players;

  return (
    <div className="table-card">
      <div className="table-card-header">
        <h4 className="table-name">{table.table_name}</h4>
        {getStatusBadge()}
      </div>
      
      <div className="table-card-body">
        <div className="table-info">
          <span className="players-count">
            {table.players.length}/{table.max_players} players
          </span>
          {table.password_protected && (
            <span className="password-icon" title="Password protected">🔒</span>
          )}
        </div>
        
        <div className="players-list">
          {table.players.map(player => (
            <span key={player.id} className="player-name">
              {player.name}
            </span>
          ))}
        </div>
      </div>
      
      <div className="table-card-footer">
        <button 
          className={`btn ${isJoinable ? 'btn-primary' : 'btn-disabled'}`}
          onClick={handleJoin}
          disabled={!isJoinable}
        >
          {isJoinable ? 'Join Table' : 'Cannot Join'}
        </button>
      </div>
    </div>
  );
};

export default PublicTablesList;
