import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import useGameStore from '../store/gameStore.js'
import RulesModal from '../components/RulesModal.jsx'

export default function MainMenu() {
  const navigate = useNavigate()
  const [showOnlineForm, setShowOnlineForm] = useState(false)
  const [name, setName] = useState('')
  const [showRules, setShowRules] = useState(false)
  const setPlayerIdentity = useGameStore((s) => s.setPlayerIdentity)

  const handleOnline = () => {
    if (!showOnlineForm) { setShowOnlineForm(true); return }
    if (!name.trim()) { return }
    // Reuse existing persisted ID so host identity survives page refreshes
    const existingId = localStorage.getItem('playerId')
    const id = existingId || 'player_' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('playerId', id)
    localStorage.setItem('playerName', name.trim())
    setPlayerIdentity(id, name.trim())
    navigate('/online')
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Title */}
      <header className="text-center mb-12">
        <h1
          className="text-8xl font-display font-bold mb-3"
          style={{ color: '#f5c518', textShadow: '0 4px 24px rgba(245,197,24,0.3)' }}
        >
          31
        </h1>
        <p className="text-white/60 text-lg">
          Build the highest same-suit hand. Last player standing wins.
        </p>
      </header>

      {/* Mode cards */}
      <div className="w-full max-w-sm space-y-4">
        {/* Local */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-start gap-4 mb-5">
            <span className="text-3xl">♠</span>
            <div>
              <h3 className="font-semibold text-lg">Local Game</h3>
              <p className="text-white/50 text-sm mt-0.5">Play against AI opponents — no setup needed.</p>
            </div>
          </div>
          <button className="btn btn-primary w-full" onClick={() => navigate('/local/setup')}>
            Play Now
          </button>
        </div>

        {/* Online */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-start gap-4 mb-5">
            <span className="text-3xl">♣</span>
            <div>
              <h3 className="font-semibold text-lg">Online Multiplayer</h3>
              <p className="text-white/50 text-sm mt-0.5">Create or join a table with friends.</p>
            </div>
          </div>

          {showOnlineForm ? (
            <div className="space-y-3">
              <input
                className="input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOnline()}
                autoFocus
              />
              <button className="btn btn-primary w-full" onClick={handleOnline} disabled={!name.trim()}>
                Continue
              </button>
            </div>
          ) : (
            <button className="btn btn-primary w-full" onClick={handleOnline}>
              Play Online
            </button>
          )}
        </div>
      </div>

      {/* Rules */}
      <button
        className="mt-8 text-white/40 text-sm underline underline-offset-2 hover:text-white/70 transition-colors"
        onClick={() => setShowRules(true)}
      >
        How to play
      </button>

      {/* Footer */}
      <footer className="mt-10 text-white/25 text-xs flex items-center gap-2">
        <a
          href="https://github.com/spoole50"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 hover:text-white/60 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          spoole50
        </a>
      </footer>

      <RulesModal open={showRules} onClose={() => setShowRules(false)} />
    </div>
  )
}
