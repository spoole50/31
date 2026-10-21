/**
 * Round results: every player's final hand, score, and who lost a life.
 *
 * The server redeals the moment a round ends, so without this the board
 * just reset — nobody saw the hands that decided it, or why they'd lost a
 * life. Reads the `last_round` snapshot from the game state.
 */

import { useId } from 'react'
import Modal from './Modal.jsx'
import RoundResults from './RoundResults.jsx'

export default function RoundSummary({ round, players, myPlayerId, onClose }) {
  const titleId = useId()
  const nameOf = (id) => (id && id === myPlayerId ? 'You' : players[id]?.name ?? 'Someone')
  const instant = round.instant_winner_id
  const title = instant
    ? `${nameOf(instant)} hit 31!`
    : `Round ${round.round_number} over`
  const subtitle = instant
    ? 'Instant win. Everyone else loses a life.'
    : round.knocked_player_id
      ? `${nameOf(round.knocked_player_id)} knocked. Lowest hand loses a life.`
      : 'Lowest hand loses a life.'

  return (
    <Modal open onClose={onClose} labelledBy={titleId}>
      <h2 id={titleId} className="text-2xl font-bold">{title}</h2>
      <p className="text-white/70 text-sm mt-1 mb-5">{subtitle}</p>

      <RoundResults round={round} players={players} myPlayerId={myPlayerId} />

      <button className="btn btn-primary w-full mt-6" onClick={onClose} data-autofocus>
        Next round
      </button>
    </Modal>
  )
}
