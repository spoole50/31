import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'
import Spinner from '../components/Spinner.jsx'

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert']
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Copy to the clipboard; resolves to whether it worked (it can be blocked). */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function TableLobby() {
  const navigate = useNavigate()
  const {
    playerId, table, onlineGame, resuming, resumeTable,
    startOnlineGame, addAI, leaveTable, onlineLoading, onlineError, socketConnected,
  } = useGameStore()
  const [aiDifficulty, setAiDifficulty] = useState('medium')
  const [copied, setCopied] = useState(null) // 'code' | 'link' | null

  // After a refresh, try to get back into the saved table before giving up
  useEffect(() => {
    if (!table) resumeTable()
  }, [])

  // Guard: redirect if no table
  useEffect(() => {
    if (!table && !resuming) navigate('/online', { replace: true })
  }, [table, resuming, navigate])

  // Transition to game when it starts
  useEffect(() => {
    if (onlineGame) navigate('/online/game', { replace: true })
  }, [onlineGame, navigate])

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(null), 2000)
    return () => clearTimeout(t)
  }, [copied])

  if (!table) return resuming ? <Spinner label="Rejoining your table…" /> : null

  const isHost = table.host_id === playerId
  const players = table.players || []
  const canStart = players.length >= 2
  const isFull = players.length >= table.max_players
  const openSeats = table.max_players - players.length
  const hostName = players.find((p) => p.is_host)?.name ?? 'the host'
  const inviteLink = `${window.location.origin}/online?code=${table.invite_code}`

  const handleCopy = async (what) => {
    if (await copyText(what === 'code' ? table.invite_code : inviteLink)) setCopied(what)
  }

  const handleShare = async () => {
    // Native share sheet on phones; copying the link everywhere else
    if (navigator.share) {
      try {
        await navigator.share({ title: '31', text: `Join my game of 31 — code ${table.invite_code}`, url: inviteLink })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    handleCopy('link')
  }

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl font-bold truncate">{table.table_name}</h1>
          <p className="text-white/70 text-sm">
            {players.length} / {table.max_players} players
            {!socketConnected && <span className="text-red-300"> · reconnecting…</span>}
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm min-h-[2.75rem] shrink-0"
          onClick={async () => { await leaveTable(); navigate('/') }}
        >
          Leave
        </button>
      </div>

      {/* Invite */}
      {table.invite_code && (
        <section className="surface p-5 mb-6 text-center" aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="text-white/60 text-xs uppercase tracking-widest mb-1">Invite code</h2>
          <p className="text-4xl font-bold font-mono tracking-[0.3em] text-gold select-all">{table.invite_code}</p>
          <div className="flex gap-2 justify-center mt-4">
            <button className="btn btn-secondary btn-sm min-h-[2.75rem] flex-1" onClick={() => handleCopy('code')}>
              {copied === 'code' ? '✓ Copied' : 'Copy code'}
            </button>
            <button className="btn btn-secondary btn-sm min-h-[2.75rem] flex-1" onClick={handleShare}>
              {copied === 'link' ? '✓ Link copied' : 'Share link'}
            </button>
          </div>
          <span className="sr-only" role="status">{copied ? 'Copied to clipboard' : ''}</span>
        </section>
      )}

      {/* Player list */}
      <section aria-labelledby="players-heading" className="mb-6">
        <h2 id="players-heading" className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Players
        </h2>
        <ul className="space-y-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3">
              <span className="text-lg" aria-hidden="true">{p.is_ai ? '🤖' : '👤'}</span>
              <span className="flex-1 font-medium truncate">{p.name}</span>
              {p.is_ai && p.ai_difficulty && (
                <span className="badge badge-muted">{capitalize(p.ai_difficulty)}</span>
              )}
              {p.is_host && <span className="badge badge-gold">Host</span>}
              {p.id === playerId && <span className="badge badge-muted">You</span>}
            </li>
          ))}
          {openSeats > 0 && (
            <li className="rounded-xl px-4 py-3 border border-dashed border-white/15 text-white/60 text-sm text-center">
              {openSeats} open {openSeats === 1 ? 'seat' : 'seats'}
            </li>
          )}
        </ul>
      </section>

      {onlineError && <p className="text-red-300 text-sm mb-4" role="alert">{onlineError}</p>}

      {/* Host controls */}
      {isHost ? (
        <div className="space-y-4">
          {!isFull && (
            <div className="flex gap-2">
              <label htmlFor="ai-difficulty" className="sr-only">AI difficulty</label>
              <select
                id="ai-difficulty"
                className="input flex-1"
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value)}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d} className="bg-felt">{capitalize(d)} AI</option>
                ))}
              </select>
              <button className="btn btn-secondary shrink-0" onClick={() => addAI(aiDifficulty)}>
                + Add AI
              </button>
            </div>
          )}
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={startOnlineGame}
            disabled={onlineLoading || !canStart}
          >
            {onlineLoading ? 'Starting…' : 'Start Game'}
          </button>
          {!canStart && (
            <p className="text-center text-white/60 text-sm">Invite a friend or add an AI to start</p>
          )}
        </div>
      ) : (
        <p className="text-center text-white/70 text-sm mt-4 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gold animate-pulse" aria-hidden="true" />
          Waiting for <strong className="text-white">{hostName}</strong> to start…
        </p>
      )}
    </main>
  )
}
