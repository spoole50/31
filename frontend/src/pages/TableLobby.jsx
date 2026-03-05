import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'

export default function TableLobby() {
  const navigate = useNavigate()
  const {
    playerId, playerName, table, onlineGame,
    startOnlineGame, addAI, leaveTable, onlineLoading, onlineError,
  } = useGameStore()

  // Guard: redirect if no table
  useEffect(() => {
    if (!table) navigate('/online', { replace: true })
  }, [table, navigate])

  // Transition to game when it starts
  useEffect(() => {
    if (onlineGame) navigate('/online/game', { replace: true })
  }, [onlineGame, navigate])

  if (!table) return null

  const isHost = table.host_id === playerId
  const players = table.players || []
  const humanCount = players.filter((p) => !p.is_ai).length
  const canStart = humanCount >= 2 || players.length >= 2

  return (
    <div className="min-h-screen px-4 py-8 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold">{table.table_name}</h2>
          <p className="text-white/50 text-sm">{players.length} / {table.max_players} players</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={async () => { await leaveTable(); navigate('/') }}
        >
          Leave
        </button>
      </div>

      {/* Invite code */}
      {table.invite_code && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 text-center">
          <p className="text-white/50 text-xs uppercase tracking-widest mb-1">Invite code</p>
          <p className="text-3xl font-bold tracking-[0.3em] text-yellow-400">{table.invite_code}</p>
          <button
            className="text-white/40 text-xs mt-2 hover:text-white/70"
            onClick={() => navigator.clipboard?.writeText(table.invite_code)}
          >
            Copy
          </button>
        </div>
      )}

      {/* Player list */}
      <div className="space-y-2 mb-6">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3"
          >
            <span className="text-lg">{p.is_ai ? '🤖' : '👤'}</span>
            <span className="flex-1 font-medium">{p.name}</span>
            {p.is_host && (
              <span className="badge bg-yellow-500/20 text-yellow-300">Host</span>
            )}
            {p.id === playerId && (
              <span className="badge bg-white/10 text-white/60">You</span>
            )}
            {p.is_ai && p.ai_difficulty && (
              <span className="badge bg-white/10 text-white/50">{p.ai_difficulty}</span>
            )}
          </div>
        ))}
      </div>

      {/* Host controls */}
      {isHost && (
        <div className="space-y-3">
          {players.length < table.max_players && (
            <div className="flex gap-2">
              {['easy', 'medium', 'hard', 'expert'].map((d) => (
                <button key={d} className="btn btn-secondary btn-sm flex-1" onClick={() => addAI(d)}>
                  + {d[0].toUpperCase() + d.slice(1)} AI
                </button>
              ))}
            </div>
          )}
          {onlineError && <p className="text-red-400 text-sm">{onlineError}</p>}
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={startOnlineGame}
            disabled={onlineLoading || !canStart}
          >
            {onlineLoading ? 'Starting…' : 'Start Game'}
          </button>
          {!canStart && (
            <p className="text-center text-white/40 text-sm">Need at least 2 players to start</p>
          )}
        </div>
      )}

      {!isHost && (
        <p className="text-center text-white/50 text-sm mt-4">
          Waiting for <strong>{players.find((p) => p.is_host)?.name ?? 'host'}</strong> to start…
        </p>
      )}
    </div>
  )
}
