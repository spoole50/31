/**
 * End-of-game results: outcome banner, final standings, and exit actions.
 */

import { motion } from 'framer-motion'
import GameLog from './GameLog.jsx'

export default function GameOverScreen({ game, myPlayerId, isLocal, onExit, onPlayAgain }) {
  const winner = game.winner_id ? game.players[game.winner_id] : null
  const iWon = game.winner_id === myPlayerId

  const standings = Object.values(game.players).sort((a, b) => b.score - a.score)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 gap-6">
      <motion.div
        className="text-center"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="text-6xl mb-3" aria-hidden="true">{iWon ? '🏆' : '💀'}</div>
        <h2 className="text-3xl font-bold mb-2">
          {iWon ? 'You Win!' : winner ? `${winner.name} Wins` : 'Game Over'}
        </h2>
        <p className="text-white/50">
          {iWon ? 'Last player standing.' : 'Better luck next time.'}
        </p>
      </motion.div>

      <ol className="w-full max-w-sm space-y-2">
        {standings.map((p, i) => (
          <motion.li
            key={p.id}
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.08 }}
            className={`flex items-center justify-between px-4 py-3 rounded-xl
              ${p.id === game.winner_id ? 'bg-gold/20 border border-gold/40' : 'bg-white/5'}`}
          >
            <span className="font-medium">{p.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-white/50 text-sm">{p.score} pts</span>
              <div className="flex gap-0.5" aria-label={`${p.lives} lives remaining`}>
                {Array.from({ length: 3 }, (_, idx) => (
                  <span key={idx} className={`life-dot ${idx < p.lives ? 'active' : 'lost'}`} />
                ))}
              </div>
            </div>
          </motion.li>
        ))}
      </ol>

      <div className="flex gap-3">
        <button className="btn btn-secondary" onClick={onExit}>Menu</button>
        {isLocal && (
          <button className="btn btn-primary" onClick={onPlayAgain}>Play Again</button>
        )}
      </div>

      <GameLog entries={game.game_log} />
    </div>
  )
}
