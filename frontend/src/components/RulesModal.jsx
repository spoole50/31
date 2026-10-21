/**
 * How-to-play sheet. Reachable from the main menu and from inside a game.
 */

import { useId } from 'react'
import Modal from './Modal.jsx'

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">{title}</h3>
      {children}
    </section>
  )
}

export default function RulesModal({ open, onClose }) {
  const titleId = useId()
  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 id={titleId} className="text-xl font-bold">How to play 31</h2>
        <button
          className="btn btn-icon text-white/60 hover:text-white -mr-2"
          onClick={onClose}
          aria-label="Close rules"
        >
          ✕
        </button>
      </div>

      <Section title="Objective">
        <p className="text-white/70 text-sm">
          Get the highest total value of cards <strong className="text-white">in the same suit</strong>. A perfect score of 31 wins the round immediately.
        </p>
      </Section>

      <Section title="Card values">
        <ul className="text-sm text-white/70 space-y-1">
          <li><span className="text-white font-medium">Ace</span> — 11 pts</li>
          <li><span className="text-white font-medium">King, Queen, Jack</span> — 10 pts each</li>
          <li><span className="text-white font-medium">2 – 10</span> — face value</li>
          <li><span className="text-white font-medium">Three Aces</span> — counts as 31</li>
        </ul>
      </Section>

      <Section title="On your turn">
        <ol className="text-sm text-white/70 space-y-1 list-decimal list-inside">
          <li>Draw a card from the <strong className="text-white">deck</strong> or <strong className="text-white">discard pile</strong></li>
          <li>Discard one card from your hand (tap it twice, or select it and press Discard)</li>
          <li>Or, instead of drawing, <strong className="text-white">Knock</strong> to trigger the final round</li>
        </ol>
      </Section>

      <Section title="Knocking">
        <p className="text-sm text-white/70">
          When you knock, every other player gets <strong className="text-white">one final turn</strong>, then all hands are revealed. The lowest scorer loses a life.
        </p>
      </Section>

      <Section title="Lives & winning">
        <ul className="text-sm text-white/70 space-y-1">
          <li>Each player starts with <strong className="text-white">3 lives</strong></li>
          <li>Lowest scorer each round loses a life</li>
          <li>If two players tie for lowest, <strong className="text-white">both</strong> lose a life</li>
          <li>A player who scores 31 means <strong className="text-white">everyone else</strong> loses a life</li>
          <li>Last player with lives remaining <strong className="text-white">wins</strong></li>
        </ul>
      </Section>

      <button className="btn btn-primary w-full" onClick={onClose}>
        Got it
      </button>
    </Modal>
  )
}
