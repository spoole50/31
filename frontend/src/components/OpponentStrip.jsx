/**
 * Opponent status strip — compact row showing all other players' lives.
 */

export default function OpponentStrip({ players, currentPlayerId, myPlayerId }) {
  if (!players || players.length === 0) return null

  const others = Object.entries(players).filter(([id]) => id !== myPlayerId)

  return (
    <div className="flex flex-wrap gap-2 justify-center px-4">
      {others.map(([id, player]) => {
        const isActive = id === currentPlayerId
        return (
          <div
            key={id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm
              transition-all duration-300
              ${isActive
                ? 'bg-gold/20 border border-gold/40 text-gold-light'
                : 'bg-white/5 border border-white/10 text-white/70'}
              ${player.is_eliminated ? 'opacity-30 line-through' : ''}
            `}
          >
            <span>{player.is_ai ? '🤖' : '👤'}</span>
            <span className="font-medium">{player.name}</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 3 }, (_, i) => (
                <span
                  key={i}
                  className={`life-dot ${i < player.lives ? 'active' : 'lost'}`}
                />
              ))}
            </div>
            {player.has_knocked && <span className="text-orange-400 text-xs">✊</span>}
          </div>
        )
      })}
    </div>
  )
}
