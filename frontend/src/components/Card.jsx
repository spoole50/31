/**
 * A single playing card.
 *
 * Props:
 *   card        { value, suit }   — undefined for a face-down back
 *   selected    bool
 *   onClick     fn                — when given, the card is a real <button>
 *   disabled    bool
 *   small       bool              — compact size (round summary, results)
 *   index       number            — position in hand (for staggered entrance)
 *   isNew       bool              — true when just drawn (extra entrance pop)
 *   label       string            — accessible name override (defaults to the card's name)
 */

import { motion } from 'framer-motion'
import { felt, SUIT_INK } from '../lib/theme.js'

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' }
const RED_SUITS = new Set(['hearts', 'diamonds'])
const VALUE_NAMES = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack' }

const CARD_BACK_PATTERN = `repeating-linear-gradient(45deg,${felt.DEFAULT} 0 6px,${felt.light} 6px 12px)`

const FACE_VALUES = new Set(['J', 'Q', 'K'])

/** "Queen of hearts" — used for aria labels and tooltips. */
export function cardName({ value, suit }) {
  return `${VALUE_NAMES[value] ?? value} of ${suit}`
}

export default function Card({ card, selected = false, onClick, disabled = false, small = false, index = 0, isNew = false, label }) {
  const size = small ? 'card-sm' : 'card-md'
  // Hidden opponent cards arrive as {value: '?', suit: '?'}
  const isFaceDown = !card || card.suit === '?'

  if (isFaceDown) {
    return (
      <motion.div
        className={`playing-card back ${size}`}
        style={{ background: CARD_BACK_PATTERN }}
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ delay: index * 0.06, type: 'spring', stiffness: 280, damping: 22 }}
        aria-hidden="true"
      />
    )
  }

  const { value, suit } = card
  const isRed = RED_SUITS.has(suit)
  const symbol = SUIT_SYMBOLS[suit]
  const isFace = FACE_VALUES.has(value)
  const interactive = Boolean(onClick) && !disabled
  const name = cardName(card)

  // A <button> whenever the card can ever be clicked, so it is reachable by
  // keyboard. The element type must not flip with `disabled` — that would
  // remount the card and replay its entrance animation every turn.
  const Element = onClick ? motion.button : motion.div
  const elementProps = onClick
    ? { type: 'button', onClick: interactive ? onClick : undefined, disabled, 'aria-pressed': selected, 'aria-label': label ?? name }
    : { role: 'img', 'aria-label': name }

  return (
    <Element
      {...elementProps}
      layout
      className={`playing-card ${size} flex flex-col justify-between
        ${small ? 'p-1 text-[0.7rem]' : 'p-1.5 sm:p-2 text-sm sm:text-base'}
        ${selected ? 'selected' : ''}
        ${interactive ? 'interactive' : ''}
      `}
      whileHover={interactive ? { y: selected ? -16 : -6, transition: { type: 'spring', stiffness: 400, damping: 20 } } : undefined}
      whileTap={interactive ? { scale: 0.94 } : undefined}
      initial={isNew
        ? { scale: 1.25, y: -30, opacity: 0, rotateZ: -8 }
        : { rotateY: 90, opacity: 0 }
      }
      animate={{ scale: 1, y: selected ? -14 : 0, opacity: 1, rotateY: 0, rotateZ: 0 }}
      transition={{
        delay: isNew ? 0 : index * 0.06,
        type: 'spring',
        stiffness: 300,
        damping: 22,
      }}
      style={{ color: isRed ? SUIT_INK.red : SUIT_INK.black }}
      title={name}
    >
      {/* Top-left corner */}
      <span className="leading-none font-bold block" aria-hidden="true">
        <span className="block">{value}</span>
        <span className="block">{symbol}</span>
      </span>

      {/* Centre */}
      {!small && (
        <span
          className={`text-center block ${isFace ? 'text-2xl sm:text-3xl font-bold font-display' : 'text-2xl sm:text-4xl'}`}
          aria-hidden="true"
        >
          {isFace ? value : symbol}
        </span>
      )}

      {/* Bottom-right (rotated) */}
      <span className="leading-none font-bold self-end rotate-180 block" aria-hidden="true">
        <span className="block">{value}</span>
        <span className="block">{symbol}</span>
      </span>
    </Element>
  )
}
