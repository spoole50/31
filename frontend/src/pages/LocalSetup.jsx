import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'
import BackButton from '../components/BackButton.jsx'

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert']
const MAX_PLAYERS = 8
const SETUP_KEY = 'localSetup'

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** The last setup used on this device, so "Play again" isn't a re-type. */
function loadSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETUP_KEY))
    if (Array.isArray(saved?.humanNames) && Array.isArray(saved?.aiSlots)) return saved
  } catch { /* corrupt or blocked storage — fall through to defaults */ }
  return { humanNames: [''], aiSlots: [{ difficulty: 'medium' }], useTimer: false }
}

export default function LocalSetup() {
  const navigate = useNavigate()
  const { startLocalGame, localLoading, localError, clearLocalError } = useGameStore()

  const [initial] = useState(loadSetup)
  const [humanNames, setHumanNames] = useState(initial.humanNames)
  const [aiSlots, setAiSlots] = useState(initial.aiSlots)
  const [useTimer, setUseTimer] = useState(initial.useTimer)

  // Don't greet the player with an error from a previous attempt
  useEffect(() => { clearLocalError() }, [clearLocalError])

  // Every seat counts toward the cap, named or not. Counting only filled-in
  // names let you add any number of blank rows.
  const totalPlayers = humanNames.length + aiSlots.length
  const full = totalPlayers >= MAX_PLAYERS

  const addHuman = () => { if (!full) setHumanNames((n) => [...n, '']) }
  const addAI = () => { if (!full) setAiSlots((a) => [...a, { difficulty: 'medium' }]) }
  const removeHuman = (i) => setHumanNames((n) => n.filter((_, idx) => idx !== i))
  const removeAI = (i) => setAiSlots((a) => a.filter((_, idx) => idx !== i))

  const handleStart = async (e) => {
    e.preventDefault()
    // A blank name falls back to its placeholder instead of blocking Start
    const names = humanNames.map((n, i) => n.trim() || `Player ${i + 1}`)
    const difficulties = aiSlots.map((a) => a.difficulty)
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify({ humanNames, aiSlots, useTimer }))
    } catch { /* storage full or blocked — not worth failing the start */ }
    if (await startLocalGame(names, aiSlots.length, difficulties, useTimer)) {
      navigate('/local/game')
    }
  }

  return (
    <main className="flex-1 w-full max-w-md mx-auto px-4 py-6">
      <BackButton to="/" />

      <h1 className="text-2xl font-bold mb-1">Set up game</h1>
      <p className="text-white/60 text-sm mb-8">
        {totalPlayers} of {MAX_PLAYERS} seats · add more players to pass one device around
      </p>

      <form onSubmit={handleStart}>
        {/* Human players */}
        <section className="mb-6" aria-labelledby="players-heading">
          <h2 id="players-heading" className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
            Players
          </h2>
          <div className="space-y-2">
            {humanNames.map((name, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input"
                  placeholder={`Player ${i + 1}`}
                  aria-label={`Player ${i + 1} name`}
                  maxLength={32}
                  value={name}
                  onChange={(e) =>
                    setHumanNames((n) => n.map((v, idx) => (idx === i ? e.target.value : v)))
                  }
                />
                {humanNames.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon shrink-0"
                    onClick={() => removeHuman(i)}
                    aria-label={`Remove player ${i + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={addHuman} disabled={full}>
            + Add player
          </button>
        </section>

        {/* AI players */}
        <section className="mb-8" aria-labelledby="ai-heading">
          <h2 id="ai-heading" className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
            AI Opponents
          </h2>
          {aiSlots.length === 0 && (
            <p className="text-white/60 text-sm mb-2">No AI opponents — humans only.</p>
          )}
          <div className="space-y-2">
            {aiSlots.map((ai, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-white/70 text-sm w-12 shrink-0">AI {i + 1}</span>
                <select
                  className="input flex-1"
                  aria-label={`AI ${i + 1} difficulty`}
                  value={ai.difficulty}
                  onChange={(e) =>
                    setAiSlots((a) => a.map((v, idx) => (idx === i ? { difficulty: e.target.value } : v)))
                  }
                >
                  {DIFFICULTIES.map((d) => (
                    // Native <option> ignores most styling; a background is the
                    // one property that reliably applies in the dropdown list.
                    <option key={d} value={d} className="bg-felt">
                      {capitalize(d)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-icon shrink-0"
                  onClick={() => removeAI(i)}
                  aria-label={`Remove AI ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={addAI} disabled={full}>
            + Add AI
          </button>
        </section>

        {/* Options */}
        <section className="mb-8" aria-labelledby="options-heading">
          <h2 id="options-heading" className="text-sm font-medium text-white/70 uppercase tracking-wider mb-3">
            Options
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" id="timer-label">Turn timer</p>
              <p className="text-xs text-white/60" id="timer-desc">45 seconds per turn, then it's skipped</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={useTimer}
              aria-labelledby="timer-label"
              aria-describedby="timer-desc"
              onClick={() => setUseTimer((v) => !v)}
              className={`relative flex-shrink-0 w-12 h-7 rounded-full transition-colors
                ${useTimer ? 'bg-gold' : 'bg-white/20'}`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all duration-200
                  ${useTimer ? 'left-6' : 'left-1'}`}
              />
            </button>
          </div>
        </section>

        {localError && (
          <p className="text-red-300 text-sm mb-4" role="alert">{localError}</p>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-lg w-full"
          disabled={localLoading || humanNames.length === 0 || totalPlayers < 2}
        >
          {localLoading ? 'Starting…' : 'Start Game'}
        </button>

        {totalPlayers < 2 && (
          <p className="text-center text-white/60 text-sm mt-3">Add an AI or another player to start</p>
        )}
      </form>
    </main>
  )
}
