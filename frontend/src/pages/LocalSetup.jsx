import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useGameStore from '../store/gameStore.js'

const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert']

export default function LocalSetup() {
  const navigate = useNavigate()
  const { startLocalGame, localLoading, localError } = useGameStore()

  const [humanNames, setHumanNames] = useState([''])
  const [aiSlots, setAiSlots] = useState([{ difficulty: 'medium' }])
  const [useTimer, setUseTimer] = useState(false)

  const totalPlayers = humanNames.filter(Boolean).length + aiSlots.length

  const addHuman = () => {
    if (totalPlayers < 8) setHumanNames((n) => [...n, ''])
  }

  const addAI = () => {
    if (totalPlayers < 8) setAiSlots((a) => [...a, { difficulty: 'medium' }])
  }

  const removeHuman = (i) => setHumanNames((n) => n.filter((_, idx) => idx !== i))
  const removeAI = (i) => setAiSlots((a) => a.filter((_, idx) => idx !== i))

  const handleStart = async () => {
    const names = humanNames.filter(Boolean)
    if (names.length === 0) return
    const difficulties = aiSlots.map((a) => a.difficulty)
    await startLocalGame(names, aiSlots.length, difficulties, useTimer)
    navigate('/local/game')
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-md mx-auto">
      <button
        className="text-white/50 text-sm mb-6 flex items-center gap-1 hover:text-white transition-colors"
        onClick={() => navigate('/')}
      >
        ← Back
      </button>

      <h2 className="text-2xl font-bold mb-8">Set up game</h2>

      {/* Human players */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
          Players
        </h3>
        <div className="space-y-2">
          {humanNames.map((name, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                placeholder={`Player ${i + 1}`}
                value={name}
                onChange={(e) =>
                  setHumanNames((n) => n.map((v, idx) => (idx === i ? e.target.value : v)))
                }
              />
              {humanNames.length > 1 && (
                <button className="btn btn-secondary btn-sm" onClick={() => removeHuman(i)}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {totalPlayers < 8 && (
          <button className="btn btn-secondary btn-sm mt-2" onClick={addHuman}>
            + Add player
          </button>
        )}
      </section>

      {/* AI players */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
          AI Opponents
        </h3>
        <div className="space-y-2">
          {aiSlots.map((ai, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-white/60 text-sm w-20">AI {i + 1}</span>
              <select
                className="input flex-1"
                value={ai.difficulty}
                onChange={(e) =>
                  setAiSlots((a) => a.map((v, idx) => (idx === i ? { difficulty: e.target.value } : v)))
                }
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d} style={{ background: '#1a4731' }}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
              <button className="btn btn-secondary btn-sm" onClick={() => removeAI(i)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        {totalPlayers < 8 && (
          <button className="btn btn-secondary btn-sm mt-2" onClick={addAI}>
            + Add AI
          </button>
        )}
      </section>

      {/* Options */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">Options</h3>
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-sm font-medium">Turn Timer</p>
            <p className="text-xs text-white/40">45 seconds per turn</p>
          </div>
          <button
            type="button"
            onClick={() => setUseTimer((v) => !v)}
            className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors"
            style={{ background: useTimer ? '#f5c518' : 'rgba(255,255,255,0.2)' }}
          >
            <span
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
              style={{ left: useTimer ? '1.5rem' : '0.25rem' }}
            />
          </button>
        </label>
      </section>

      {localError && (
        <p className="text-red-400 text-sm mb-4">{localError}</p>
      )}

      <button
        className="btn btn-primary btn-lg w-full"
        onClick={handleStart}
        disabled={localLoading || humanNames.filter(Boolean).length === 0 || totalPlayers < 2}
      >
        {localLoading ? 'Starting…' : 'Start Game'}
      </button>

      {totalPlayers < 2 && (
        <p className="text-center text-white/40 text-sm mt-3">Need at least 2 players</p>
      )}
    </div>
  )
}
