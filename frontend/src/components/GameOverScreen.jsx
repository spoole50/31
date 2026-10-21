/**
 * End-of-game results: outcome banner, the final round's hands, standings,
 * and what to do next.
 *
 * Props:
 *   onPlayAgain  fn | undefined — local: back to setup. Online: host-only
 *                rematch. Omitted for online guests, who wait for the host.
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import GameLog from './GameLog.jsx'
import Lives from './Lives.jsx'
import RoundResults from './RoundResults.jsx'

export default function GameOverScreen({ game, myPlayerId, isLocal, onExit, onPlayAgain, playAgainLabel = 'Play again', busy = false }) {
  const [showLog, setShowLog] = useState(false)
  const winner = game.winner_id ? game.players[game.winner_id] : null
  const humans = Object.values(game.players).filter((p) => !p.is_ai)
  // In pass-and-play "you" is just whoever held the device last, so name
  // the winner instead.
  const sharedDevice = isLocal && humans.length > 1
  const iWon = !sharedDevice && game.winner_id === myPlayerId
  const humanWon = winner && !winner.is_ai

  // Standings are about survival: winner, then most lives left. The old sort
  // used `score`, which is only the last hand's value.
  const lastScores = Object.fromEntries((game.last_round?.results ?? []).map((r) => [r.player_id, r.score]))
  const standings = Object.values(game.players).sort((a, b) =>
    (b.id === game.winner_id) - (a.id === game.winner_id) ||
    b.lives - a.lives ||
    (lastScores[b.id] ?? 0) - (lastScores[a.id] ?? 0))

  const celebrate = iWon || (sharedDevice && humanWon)
  const headline = iWon ? 'You win!' : winner ? `${winner.name} wins` : 'Game over'

  return (
    <div className="flex-1 w-full max-w-md mx-auto flex flex-col items-center px-4 py-10 gap-6">
      <motion.div
        className="text-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="text-6xl mb-3" aria-hidden="true">{celebrate ? '🏆' : '🃏'}</div>
        <h1 className="text-3xl font-bold mb-1">{headline}</h1>
        <p className="text-white/70">{celebrate ? 'Last player standing.' : 'Better luck next time.'}</p>
      </motion.div>

      <section className="w-full" aria-labelledby="standings-heading">
        <h2 id="standings-heading" className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
          Standings
        </h2>
        <ol className="space-y-2">
          {standings.map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border
                ${p.id === game.winner_id ? 'bg-gold/20 border-gold/40' : 'bg-white/5 border-white/10'}`}
            >
              <span className="w-5 text-white/60 text-sm tabular-nums">{i + 1}</span>
              <span className="flex-1 font-medium truncate">
                {p.name}
                {p.id === myPlayerId && !sharedDevice && <span className="text-white/60 font-normal"> (you)</span>}
              </span>
              <Lives lives={p.lives} />
            </motion.li>
          ))}
        </ol>
      </section>

      {game.last_round && (
        <section className="w-full" aria-labelledby="final-round-heading">
          <h2 id="final-round-heading" className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
            Final round
          </h2>
          <RoundResults round={game.last_round} players={game.players} myPlayerId={sharedDevice ? null : myPlayerId} />
        </section>
      )}

      <div className="w-full flex gap-3">
        <button className="btn btn-secondary flex-1" onClick={onExit}>Menu</button>
        {onPlayAgain && (
          <button className="btn btn-primary flex-1" onClick={onPlayAgain} disabled={busy}>
            {busy ? 'Starting…' : playAgainLabel}
          </button>
        )}
      </div>
      {!isLocal && !onPlayAgain && (
        <p className="text-white/60 text-sm -mt-3">The host can start a rematch.</p>
      )}

      <div className="w-full">
        <button
          className="text-white/60 hover:text-white text-sm underline underline-offset-2"
          onClick={() => setShowLog((v) => !v)}
          aria-expanded={showLog}
        >
          {showLog ? 'Hide game log' : 'Show game log'}
        </button>
        {showLog && <GameLog entries={game.game_log} className="h-48 mt-2" />}
      </div>
    </div>
  )
}
