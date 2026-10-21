import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'
import BackButton from '../components/BackButton.jsx'

const CODE_LENGTH = 6

/** Invite codes are 6 uppercase letters/digits; tolerate pasted spaces or dashes. */
const normalizeCode = (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH)

export default function OnlineLobby() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const linkCode = normalizeCode(searchParams.get('code') ?? '')
  const { playerId, playerName, createTable, joinTable, onlineLoading, onlineError, clearOnlineError } =
    useGameStore()

  const [tab, setTab] = useState(linkCode ? 'join' : 'create')  // 'create' | 'join'
  const [tableName, setTableName] = useState(`${playerName}'s Game`)
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [inviteCode, setInviteCode] = useState(linkCode)

  // Reached directly (bookmark, invite link) without a name yet: collect one
  // first, carrying the invite code along.
  const hasIdentity = Boolean(playerId && playerName)
  useEffect(() => {
    if (!hasIdentity) navigate(linkCode ? `/?join=${linkCode}` : '/', { replace: true })
  }, [hasIdentity, linkCode, navigate])

  useEffect(() => { clearOnlineError() }, [tab, clearOnlineError])

  const handleCreate = async (e) => {
    e.preventDefault()
    // Private: joinable only with the invite code, never listed or joinable by id
    if (await createTable(tableName.trim() || `${playerName}'s Game`, maxPlayers, true)) {
      navigate('/online/table')
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    if (inviteCode.length < CODE_LENGTH) return
    if (await joinTable(inviteCode)) navigate('/online/table')
  }

  if (!hasIdentity) return null

  const tabs = [
    { id: 'create', label: 'Create table' },
    { id: 'join', label: 'Join table' },
  ]

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 py-6">
      <BackButton to="/" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Online Play</h1>
        <p className="text-white/70 text-sm mt-1">
          Playing as <strong className="text-white">{playerName}</strong>
          {' · '}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-white"
            onClick={() => navigate('/')}
          >
            change
          </button>
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-white/5 rounded-xl p-1 mb-6" role="tablist" aria-label="Online play">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={`flex-1 min-h-[2.75rem] rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white/80'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'create' ? (
        <form id="panel-create" role="tabpanel" aria-labelledby="tab-create" className="space-y-5" onSubmit={handleCreate}>
          <div>
            <label htmlFor="table-name" className="text-sm text-white/70 mb-1 block">Table name</label>
            <input
              id="table-name"
              className="input"
              maxLength={40}
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="max-players" className="text-sm text-white/70 mb-1 flex justify-between">
              <span>Max players</span>
              <span className="text-white font-semibold tabular-nums">{maxPlayers}</span>
            </label>
            <input
              id="max-players"
              type="range"
              min={2}
              max={8}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="w-full accent-gold h-6"
            />
          </div>
          <p className="text-white/60 text-xs">
            Tables are private — friends join with the invite code you'll get next.
          </p>
          {onlineError && <p className="text-red-300 text-sm" role="alert">{onlineError}</p>}
          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={onlineLoading}>
            {onlineLoading ? 'Creating…' : 'Create Table'}
          </button>
        </form>
      ) : (
        <form id="panel-join" role="tabpanel" aria-labelledby="tab-join" className="space-y-5" onSubmit={handleJoin}>
          <div>
            <label htmlFor="invite-code" className="text-sm text-white/70 mb-1 block">Invite code</label>
            <input
              id="invite-code"
              className="input text-center text-2xl font-mono tracking-[0.4em] uppercase"
              placeholder="ABC123"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(normalizeCode(e.target.value))}
              autoFocus={!linkCode}
            />
          </div>
          {onlineError && <p className="text-red-300 text-sm" role="alert">{onlineError}</p>}
          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={onlineLoading || inviteCode.length < CODE_LENGTH}
          >
            {onlineLoading ? 'Joining…' : 'Join Table'}
          </button>
        </form>
      )}
    </main>
  )
}
