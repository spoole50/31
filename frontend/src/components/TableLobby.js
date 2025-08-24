import React, { useState } from 'react';
import useTableManager from '../hooks/useTableManager';
import CreateTableForm from './CreateTableForm';
import PublicTablesList from './PublicTablesList';
import CurrentTableView from './CurrentTableView';
import JoinTableForm from './JoinTableForm';
import TableStatus from './TableStatus';
import './TableLobby.css';

const TableLobby = ({ playerId, playerName, onGameStart, onBackToMenu }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);

  const {
    currentTable,
    publicTables,
    loading,
    error,
    createTable,
    joinTable,
    joinTableByCode,
    leaveTable,
    startGame,
    addAIPlayer,
    refreshPublicTables
  } = useTableManager(playerId, playerName, onGameStart);

  const handleCreateTable = async (tableData) => {
    // Add required host information
    const completeTableData = {
      ...tableData,
      host_id: playerId,
      host_name: playerName
    };
    await createTable(completeTableData);
    setShowCreateForm(false);
  };

  const handleJoinByCode = async (code, password) => {
    await joinTableByCode(code, password);
    setShowJoinForm(false);
  };

  // If player is in a table, show the table view
  if (currentTable) {
    return (
      <div className="table-lobby">
        <TableStatus
          currentTable={currentTable}
          playerName={playerName}
          onStartGame={startGame}
          onLeaveTable={leaveTable}
          loading={loading}
        />

        {error && <div className="error-message">{error}</div>}

        <CurrentTableView
          table={currentTable}
          playerId={playerId}
          playerName={playerName}
          onStartGame={startGame}
          onLeaveTable={leaveTable}
          onAddAI={addAIPlayer}
          onGameStart={onGameStart}
          loading={loading}
        />

        <div className="table-actions">
          <button onClick={onBackToMenu} className="btn btn-secondary">
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // Show lobby view if not in a table
  return (
    <div className="table-lobby">
      <div className="lobby-header">
        <h2>Game Lobby</h2>
        <p>Welcome, {playerName}!</p>
        <button onClick={onBackToMenu} className="btn btn-secondary back-btn">
          Back to Menu
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="lobby-sections">
        <div className="create-section">
          <h3>Create New Table</h3>
          
          {!showCreateForm ? (
            <button 
              onClick={() => setShowCreateForm(true)}
              className="btn btn-primary"
            >
              Create Table
            </button>
          ) : (
            <CreateTableForm
              onCreateTable={handleCreateTable}
              onCancel={() => setShowCreateForm(false)}
              playerName={playerName}
              loading={loading}
            />
          )}
        </div>

        <div className="join-section">
          <h3>Join Table</h3>
          
          <div className="join-options">
            {!showJoinForm ? (
              <button 
                onClick={() => setShowJoinForm(true)}
                className="btn btn-primary"
              >
                Join by Code
              </button>
            ) : (
              <JoinTableForm
                onJoinByCode={handleJoinByCode}
                onCancel={() => setShowJoinForm(false)}
                loading={loading}
              />
            )}
          </div>

          <PublicTablesList
            tables={publicTables}
            onJoinTable={joinTable}
            onRefresh={refreshPublicTables}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
};

export default TableLobby;
