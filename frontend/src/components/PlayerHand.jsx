/**
 * The viewing player's hand.
 *
 * With 4 cards on your turn (you have drawn), tapping a card selects it and
 * tapping it again discards it; the Discard button does the same for anyone
 * who prefers an explicit confirm.
 *
 * Below the cards is a fixed-height slot holding either the Discard button or
 * a one-line prompt (`hint`), so the layout never jumps between turns.
 */

import { useEffect, useState } from 'react'
import Card from './Card.jsx'
import Lives from './Lives.jsx'

const FULL_HAND = 4

export default function PlayerHand({ player, isActivePlayer, canInteract, onDiscard, gamePhase, hint }) {
  const [selectedIndex, setSelectedIndex] = useState(null)
  const hand = player?.hand || []

  // Drop any selection whenever the hand changes under us — including when
  // a server-side turn timeout force-discards — so a stale index never leaves
  // a card looking pre-selected on a later turn.
  const handSignature = hand.map((c) => `${c.value}${c.suit}`).join()
  useEffect(() => { setSelectedIndex(null) }, [handSignature])

  const canDiscard = canInteract && hand.length === FULL_HAND

  const discard = (i) => {
    setSelectedIndex(null)
    onDiscard(i)
  }

  const handleCardClick = (i) => {
    if (!canDiscard) return
    if (selectedIndex === i) discard(i)
    else setSelectedIndex(i)
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Player info bar */}
      <div className="flex items-center gap-2.5 h-6">
        <span className="font-semibold text-sm">{player.name}</span>
        <Lives lives={player.lives} />
        {typeof player.score === 'number' && (
          <span className="text-white/70 text-xs tabular-nums" title="Your best same-suit total">
            {player.score} pts
          </span>
        )}
        {player.has_knocked && <span className="badge badge-knocked">Knocked</span>}
        {isActivePlayer && (
          <span className="badge badge-gold">
            {gamePhase === 'final_round' ? 'Final turn' : 'Your turn'}
          </span>
        )}
      </div>

      {/* Cards. Keyed by identity, not position: with the index in the key,
          discarding the first card re-keyed every card after it, so the whole
          hand remounted and replayed its deal animation. */}
      <div className="flex gap-2 pt-3" role="group" aria-label="Your hand">
        {hand.map((card, i) => (
          <Card
            key={`${card.value}-${card.suit}`}
            card={card}
            selected={selectedIndex === i}
            onClick={() => handleCardClick(i)}
            disabled={!canDiscard}
            index={i}
            // The drawn card is always appended, and a 4th card only
            // exists right after a draw — so it is the one to pop in.
            isNew={i === FULL_HAND - 1}
          />
        ))}
        {Array.from({ length: Math.max(0, FULL_HAND - hand.length) }, (_, i) => (
          <div key={`ph-${i}`} className="card-md aspect-[2.5/3.5] rounded-lg border-2 border-dashed border-white/10" aria-hidden="true" />
        ))}
      </div>

      <div className="h-11 flex items-center">
        {canDiscard ? (
          <button
            className="btn btn-danger"
            onClick={() => discard(selectedIndex)}
            disabled={selectedIndex === null}
          >
            {selectedIndex !== null ? 'Discard selected' : 'Choose a card to discard'}
          </button>
        ) : (
          hint && <p className="text-white/70 text-sm text-center">{hint}</p>
        )}
      </div>
    </div>
  )
}
