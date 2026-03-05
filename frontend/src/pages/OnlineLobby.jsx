import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'

export default function OnlineLobby() {
  const navigate = useNavigate()
  const { playerId, playerName, createTable, joinTable, onlineLoading, onlineError, clearOnlineError } =
    useGameStore()

  const [tab, setTab] = useState('create')  // 'create' | 'join'
  const [tableName, setTableName] = useState(`${playerName}'s Game`)
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [inviteCode, setInviteCode] = useState('')

  const handleCreate = async () => {
    clearOnlineError()
    await createTable(tableName, maxPlayers, false)
    navigate('/online/table')
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    clearOnlineError()
    await joinTable(inviteCode.trim().toUpperCase())
    navigate('/online/table')
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-md mx-auto">
      <button
        className="text-white/50 text-sm mb-6 flex items-center gap-1 hover:text-white"
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      <div className="mb-6">
        <h2 className="text-2xl font-bold">Online Play</h2>
        <p className="text-white/50 text-sm mt-1">Playing as <strong>{playerName}</strong></p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-white/5 rounded-xl p-1 mb-6">
        {['create', 'join'].map((t) => (
          <button
            key={t}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'create' ? 'Create table' : 'Join table'}
          </button>
        ))}
      </div>

      {tab === 'create' ? (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1 block">Table name</label>
            <input className="input" value={tableName} onChange={(e) => setTableName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-white/60 mb-1 block">Max players: {maxPlayers}</label>
            <input
              type="range"
              min={2}
              max={8}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
          </div>
          {onlineError && <p className="text-red-400 text-sm">{onlineError}</p>}
          <button className="btn btn-primary btn-lg w-full" onClick={handleCreate} disabled={onlineLoading}>
            {onlineLoading ? 'Creating…' : 'Create Table'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm text-white/60 mb-1 block">Invite code</label>
            <input
              className="input text-center text-xl tracking-widest uppercase"
              placeholder="XXXXXX"
              maxLength={6}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>
          {onlineError && <p className="text-red-400 text-sm">{onlineError}</p>}
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={handleJoin}
            disabled={onlineLoading || inviteCode.length < 6}
          >
            {onlineLoading ? 'Joining…' : 'Join Table'}
          </button>
        </div>
      )}
    </div>
  )
}
