/**
 * One row per player for a finished round: name, revealed hand, score, and
 * the outcome. Shared by the between-rounds summary and the game-over screen.
 */

import Card from './Card.jsx'

function Outcome({ result }) {
  if (result.eliminated && result.lost_life) {
    return <span className="badge bg-red-500/20 text-red-300">Out</span>
  }
  if (result.lost_life) {
    return <span className="badge bg-red-500/20 text-red-300">−1 life</span>
  }
  return <span className="badge badge-muted">Safe</span>
}

export default function RoundResults({ round, players, myPlayerId }) {
  const best = round.results[0]?.score
  return (
    <ul className="space-y-2">
      {round.results.map((r) => {
        const isMe = r.player_id === myPlayerId
        const name = players[r.player_id]?.name ?? 'Player'
        return (
          <li
            key={r.player_id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border
              ${r.lost_life ? 'bg-red-500/10 border-red-400/20' : 'bg-white/5 border-white/10'}`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">
                {name}
                {isMe && <span className="text-white/60 font-normal"> (you)</span>}
              </p>
              <p className="flex items-center gap-2 mt-0.5 text-xs text-white/60 tabular-nums">
                <span>
                  {r.score} pts
                  {r.score === best && (
                    <span className="text-gold-light" title="Best hand">
                      <span aria-hidden="true"> ★</span>
                      <span className="sr-only">, best hand</span>
                    </span>
                  )}
                </span>
                <Outcome result={r} />
              </p>
            </div>
            <div className="flex gap-1 shrink-0" role="group" aria-label={`${name}'s hand`}>
              {r.hand.map((card) => (
                <Card key={`${card.value}-${card.suit}`} card={card} small />
              ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
