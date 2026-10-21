/**
 * Opponent status strip — one chip per other player: lives, knock state,
 * whose turn it is, and who is out.
 */

import Lives from './Lives.jsx'

export default function OpponentStrip({ players, currentPlayerId, myPlayerId }) {
  // `players` is an object keyed by id — the old `players.length` guard was
  // always undefined, so it never fired.
  const others = Object.entries(players ?? {}).filter(([id]) => id !== myPlayerId)
  if (others.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-1.5 sm:gap-2 justify-center px-4" aria-label="Opponents">
      {others.map(([id, player]) => {
        const isActive = id === currentPlayerId
        const out = player.is_eliminated
        return (
          <li
            key={id}
            className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs sm:text-sm
              transition-colors duration-300 border
              ${isActive
                ? 'bg-gold/20 border-gold/50 text-gold-light shadow-glow'
                : 'bg-white/5 border-white/10 text-white/80'}
              ${out ? 'opacity-50' : ''}
            `}
            aria-current={isActive ? 'true' : undefined}
          >
            <span aria-hidden="true">{out ? '💀' : player.is_ai ? '🤖' : '👤'}</span>
            <span className={`font-medium ${out ? 'line-through' : ''}`}>{player.name}</span>
            {out ? (
              <span className="text-xs">Out</span>
            ) : (
              <Lives lives={player.lives} />
            )}
            {player.has_knocked && (
              <span className="badge badge-knocked" title="Knocked">Knocked</span>
            )}
            {isActive && player.is_ai && (
              <span className="text-xs text-gold-light/80 animate-pulse">thinking…</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
