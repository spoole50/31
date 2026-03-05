/**
 * A player's hand of cards.
 *
 * When isActivePlayer && canInteract, clicking a card selects it (if 4 cards)
 * or does nothing (3 cards — must draw first).
 * Selected card is highlighted; tapping again or pressing "Discard" confirms.
 */

import { useEffect, useRef, useState } from 'react'
import Card from './Card.jsx'

export default function PlayerHand({
  player,
  isCurrentPlayer,
  isActivePlayer,
  canInteract,
  onDiscard,
  gamePhase,
}) {
  const [selectedIndex, setSelectedIndex] = useState(null)
  const prevHandLengthRef = useRef(player?.hand?.length ?? 0)
  const [newCardIndex, setNewCardIndex] = useState(null)

  const hand = player?.hand || []

  // Detect when a card was just drawn (hand grew by 1) so we can pop-animate it
  useEffect(() => {
    const prev = prevHandLengthRef.current
    if (hand.length === prev + 1) {
      setNewCardIndex(hand.length - 1)
      const t = setTimeout(() => setNewCardIndex(null), 400)
      prevHandLengthRef.current = hand.length
      return () => clearTimeout(t)
    }
    prevHandLengthRef.current = hand.length
    setNewCardIndex(null)
  }, [hand.length])

  const canDiscard = canInteract && hand.length === 4

  const handleCardClick = (i) => {
    if (!canDiscard) return
    setSelectedIndex(selectedIndex === i ? null : i)
  }

  const handleDiscard = () => {
    if (selectedIndex === null) return
    onDiscard(selectedIndex)
    setSelectedIndex(null)
  }

  const liveDots = Array.from({ length: 3 }, (_, i) => (
    <span key={i} className={`life-dot ${i < player.lives ? 'active' : 'lost'}`} />
  ))

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Player info bar */}
      <div className="flex items-center gap-3">
        <span className="font-semibold text-sm">{player.name}</span>
        {player.is_ai && <span className="text-white/40 text-xs">AI</span>}
        <div className="flex gap-1">{liveDots}</div>
        {player.has_knocked && (
          <span className="badge bg-orange-500/20 text-orange-300 text-xs">Knocked</span>
        )}
        {isActivePlayer && (
          <span className="badge bg-yellow-500/20 text-yellow-300 text-xs">
            {gamePhase === 'final_round' ? 'Final turn' : 'Active'}
          </span>
        )}
      </div>

      {/* Cards */}
      <div className="flex gap-2">
        {hand.map((card, i) => (
          <Card
            key={`${card.value}-${card.suit}-${i}`}
            card={isCurrentPlayer ? card : null}
            selected={selectedIndex === i}
            onClick={() => handleCardClick(i)}
            disabled={!canDiscard}
            small={!isCurrentPlayer}
            index={i}
            isNew={i === newCardIndex}
          />
        ))}
        {hand.length < 4 && isCurrentPlayer &&
          Array.from({ length: 4 - hand.length }).map((_, i) => (
            <div key={`ph-${i}`} className="w-16 opacity-0 pointer-events-none" style={{ aspectRatio: '2.5/3.5' }} />
          ))}
      </div>

      {canDiscard && (
        <button
          className="btn btn-danger btn-sm mt-1"
          onClick={handleDiscard}
          disabled={selectedIndex === null}
        >
          {selectedIndex !== null ? 'Discard selected' : 'Select a card to discard'}
        </button>
      )}

      {/* Score hint for current player */}
      {isCurrentPlayer && typeof player.score === 'number' && (
        <span className="text-white/40 text-xs">Best hand: {player.score} pts</span>
      )}
    </div>
  )
}
