import React, { useState } from 'react';

const JoinTableForm = ({ onJoinByCode, onCancel, loading }) => {
  const [joinCode, setJoinCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    try {
      await onJoinByCode(joinCode.trim(), password);
    } catch (error) {
      // Check if password is required
      if (error.message.includes('password') || error.message.includes('Password')) {
        setShowPasswordInput(true);
      }
    }
  };

  const handleCodeChange = (e) => {
    const code = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setJoinCode(code);
    setShowPasswordInput(false);
    setPassword('');
  };

  return (
    <div className="join-form">
      <h3>Join Table by Code</h3>
      <form onSubmit={handleSubmit} className="form-inline">
        <div className="form-group">
          <label htmlFor="joinCode">Invite Code:</label>
          <input
            type="text"
            id="joinCode"
            value={joinCode}
            onChange={handleCodeChange}
            placeholder="Enter 6-character code"
            maxLength={6}
            required
            disabled={loading}
            className="code-input"
          />
        </div>
        
        {showPasswordInput && (
          <div className="form-group">
            <label htmlFor="joinPassword">Password:</label>
            <input
              type="password"
              id="joinPassword"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter table password"
              disabled={loading}
            />
          </div>
        )}
        
        <div className="form-actions">
          <button 
            type="submit" 
            className={`btn btn-primary ${loading ? 'btn-loading' : ''}`}
            disabled={loading || !joinCode.trim()}
          >
            Join Table
          </button>
          {onCancel && (
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      
      <div className="join-help">
        <p className="text-sm text-muted">
          Enter the 6-character invite code shared by the table owner
        </p>
      </div>
    </div>
  );
};

export default JoinTableForm;
