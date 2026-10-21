import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import useGameStore from '../store/gameStore.js'
import RulesModal from '../components/RulesModal.jsx'

export default function MainMenu() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Arriving from an invite link: /?join=ABC123 (sent here by OnlineLobby
  // when there's no name yet). Open the name form straight away.
  const joinCode = searchParams.get('join')
  const savedName = useGameStore((s) => s.playerName)
  const setPlayerIdentity = useGameStore((s) => s.setPlayerIdentity)
  const [showOnlineForm, setShowOnlineForm] = useState(Boolean(joinCode))
  const [name, setName] = useState(savedName)
  const [showRules, setShowRules] = useState(false)

  const handleOnline = (e) => {
    e?.preventDefault()
    if (!showOnlineForm) { setShowOnlineForm(true); return }
    if (!name.trim()) return
    // Reuse existing persisted ID so host identity survives page refreshes
    const existingId = localStorage.getItem('playerId')
    const id = existingId || 'player_' + Math.random().toString(36).slice(2, 10)
    setPlayerIdentity(id, name.trim())
    navigate(joinCode ? `/online?code=${encodeURIComponent(joinCode)}` : '/online')
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
      {/* Title */}
      <header className="text-center mb-10">
        <div className="flex justify-center gap-3 text-2xl mb-2" aria-hidden="true">
          <span className="text-white/70">♠</span>
          <span className="text-red-400">♥</span>
          <span className="text-white/70">♣</span>
          <span className="text-red-400">♦</span>
        </div>
        <h1 className="text-8xl font-display font-bold mb-3 text-gold drop-shadow-[0_4px_24px_rgba(245,197,24,0.3)]">
          31
        </h1>
        <p className="text-white/70 text-lg max-w-xs mx-auto">
          Build the highest same-suit hand. Last player standing wins.
        </p>
      </header>

      {/* Mode cards */}
      <div className="w-full max-w-sm space-y-4">
        {joinCode && (
          <p className="surface px-4 py-3 text-sm text-center text-gold-light border-gold/30">
            You've been invited to a table. Enter your name to join.
          </p>
        )}

        {/* Local */}
        {!joinCode && (
          <section className="surface p-6" aria-labelledby="local-heading">
            <div className="flex items-start gap-4 mb-5">
              <span className="text-3xl" aria-hidden="true">♠</span>
              <div>
                <h2 id="local-heading" className="font-semibold text-lg">Local Game</h2>
                <p className="text-white/60 text-sm mt-0.5">Play AI opponents, or pass one device around.</p>
              </div>
            </div>
            <button className="btn btn-primary w-full" onClick={() => navigate('/local/setup')}>
              Play Now
            </button>
          </section>
        )}

        {/* Online */}
        <section className="surface p-6" aria-labelledby="online-heading">
          <div className="flex items-start gap-4 mb-5">
            <span className="text-3xl" aria-hidden="true">♣</span>
            <div>
              <h2 id="online-heading" className="font-semibold text-lg">Online Multiplayer</h2>
              <p className="text-white/60 text-sm mt-0.5">Create or join a table with friends.</p>
            </div>
          </div>

          {showOnlineForm ? (
            <form className="space-y-3" onSubmit={handleOnline}>
              <label htmlFor="player-name" className="sr-only">Your name</label>
              <input
                id="player-name"
                className="input"
                placeholder="Your name"
                maxLength={32}
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn-primary w-full" disabled={!name.trim()}>
                {joinCode ? 'Join table' : 'Continue'}
              </button>
            </form>
          ) : (
            <button className="btn btn-primary w-full" onClick={handleOnline}>
              Play Online
            </button>
          )}
        </section>
      </div>

      {/* Rules */}
      <button
        className="mt-8 text-white/70 text-sm underline underline-offset-2 hover:text-white transition-colors min-h-[2.75rem] px-2"
        onClick={() => setShowRules(true)}
      >
        How to play
      </button>

      {/* Footer */}
      <footer className="mt-6 text-white/60 text-xs flex items-center gap-2">
        <a
          href="https://github.com/spoole50"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          spoole50
        </a>
      </footer>

      <RulesModal open={showRules} onClose={() => setShowRules(false)} />
    </main>
  )
}
