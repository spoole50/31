// Custom hook for table management
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const useTableManager = (playerId, playerName, onGameStart) => {
  const [currentTable, setCurrentTable] = useState(null);
  const [publicTables, setPublicTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if player is already in a table
  const checkPlayerTable = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/player/${playerId}/table`);
      setCurrentTable(response.data);
      return response.data;
    } catch (err) {
      // Player not in a table, which is fine
      setCurrentTable(null);
      return null;
    }
  };

  // Load public tables
  const loadPublicTables = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/tables/public`);
      // Backend returns {tables: [...]} format
      setPublicTables(response.data.tables || response.data);
    } catch (err) {
      setError('Failed to load tables');
      console.error('Error loading public tables:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh current table
  const refreshTable = async () => {
    if (!currentTable) return;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/tables/${currentTable.table_id}`);
      const updatedTable = response.data;
      setCurrentTable(updatedTable);
      
      // Check if game has started and trigger callback
      if (updatedTable.status === 'playing' && onGameStart) {
        try {
          const gameResponse = await axios.get(`${API_BASE_URL}/tables/${updatedTable.table_id}/game`);
          onGameStart(updatedTable.table_id, gameResponse.data);
        } catch (gameErr) {
          console.error('Failed to get game state for playing table:', gameErr);
          setError('Game state unavailable. Please try refreshing.');
        }
      }
    } catch (err) {
      console.error('Error refreshing table:', err);
      // If table no longer exists, clear it
      if (err.response?.status === 404) {
        setCurrentTable(null);
      }
    }
  };

  // Create a new table
  const createTable = async (tableData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/tables`, tableData);
      const table = response.data;
      
      // Host is automatically added to the table when it's created
      // No need to call joinTable - just set the current table
      setCurrentTable(table);
      return table;
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to create table';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Join a table
  const joinTable = async (tableId, password = '') => {
    try {
      setLoading(true);
      setError(null);
      
      await axios.post(`${API_BASE_URL}/tables/${tableId}/join`, {
        player_id: playerId,
        player_name: playerName,
        password: password
      });
      
      // Refresh table data
      const response = await axios.get(`${API_BASE_URL}/tables/${tableId}`);
      setCurrentTable(response.data);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to join table';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Leave current table
  const leaveTable = async () => {
    if (!currentTable) return;
    
    try {
      setLoading(true);
      setError(null);
      
      await axios.post(`${API_BASE_URL}/tables/${currentTable.table_id}/leave`, {
        player_id: playerId
      });
      
      setCurrentTable(null);
      await loadPublicTables(); // Refresh public tables
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to leave table';
      setError(errorMsg);
      console.error('Error leaving table:', err);
    } finally {
      setLoading(false);
    }
  };

  // Start game
  const startGame = async () => {
    if (!currentTable) return;
    
    try {
      setLoading(true);
      setError(null);
      
      await axios.post(`${API_BASE_URL}/tables/${currentTable.table_id}/start`, {
        host_id: playerId
      });
      
      // Refresh table to get updated status
      await refreshTable();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to start game';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Join by invite code
  const joinTableByCode = async (inviteCode, password = '') => {
    try {
      setLoading(true);
      setError(null);
      
      await axios.post(`${API_BASE_URL}/tables/join-by-code`, {
        invite_code: inviteCode,
        player_id: playerId,
        password: password
      });
      
      // Find and set the joined table
      await checkPlayerTable();
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to join with code';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Add AI player
  const addAIPlayer = async (difficulty = 'medium') => {
    if (!currentTable) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/tables/${currentTable.table_id}/add-ai`, {
        host_id: playerId,
        difficulty: difficulty
      });
      
      setCurrentTable(response.data);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to add AI player';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Refresh public tables
  const refreshPublicTables = async () => {
    await loadPublicTables();
  };

  // Initialize on mount
  useEffect(() => {
    checkPlayerTable().then((table) => {
      if (!table) {
        loadPublicTables();
      }
    });
  }, [playerId]);

  // Poll for updates when in a table
  useEffect(() => {
    let interval;
    if (currentTable) {
      interval = setInterval(refreshTable, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentTable]);

  return {
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
    refreshTable,
    refreshPublicTables,
    setError
  };
};

export default useTableManager;
