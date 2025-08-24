import React, { useState } from 'react';

const CreateTableForm = ({ onCreateTable, onCancel, loading, playerName }) => {
  const [formData, setFormData] = useState({
    table_name: '',
    max_players: 4,
    is_private: true,
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Use default table name if none provided
      const finalTableName = formData.table_name.trim() || `${playerName} table`;
      await onCreateTable({
        ...formData,
        table_name: finalTableName
      });
    } catch (error) {
      // Error is handled by parent component
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create New Table</h2>
          <button 
            className="modal-close" 
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="table_name">Table Name:</label>
            <input
              type="text"
              id="table_name"
              name="table_name"
              value={formData.table_name}
              onChange={handleChange}
              placeholder={`Enter table name (default: ${playerName} table)`}
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="max_players">Max Players:</label>
            <select
              id="max_players"
              name="max_players"
              value={formData.max_players}
              onChange={handleChange}
              disabled={loading}
            >
              <option value={2}>2 Players</option>
              <option value={3}>3 Players</option>
              <option value={4}>4 Players</option>
            </select>
          </div>
          
          <div className="form-group">
            <label className="form-group-inline">
              <input
                type="checkbox"
                name="is_private"
                checked={formData.is_private}
                onChange={handleChange}
                disabled={loading}
              />
              Private Table
            </label>
          </div>
          
          {formData.is_private && (
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password (optional)"
                disabled={loading}
              />
            </div>
          )}
        </form>
        
        <div className="modal-footer">
          <div className="setup-buttons">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
              onClick={handleSubmit}
              disabled={loading}
            >
              Create Table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTableForm;
