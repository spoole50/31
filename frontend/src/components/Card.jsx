/**
 * A single playing card.
 *
 * Props:
 *   card        { value, suit }   — undefined for a face-down back
 *   selected    bool
 *   onClick     fn
 *   disabled    bool
 *   small       bool              — compact size for opponents
 *   index       number            — position in hand (for staggered entrance)
 *   isNew       bool              — true when just drawn (extra entrance pop)
 */

import { motion } from 'framer-motion'

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' }
const RED_SUITS = new Set(['hearts', 'diamonds'])

const FACE_GLYPHS = { J: 'J', Q: 'Q', K: 'K' }

export default function Card({ card, selected = false, onClick, disabled = false, small = false, index = 0, isNew = false }) {
  const isFaceDown = !card

  if (isFaceDown) {
    return (
      <motion.div
        className={`playing-card back ${small ? 'w-9' : 'w-16'}`}
        style={{ background: 'repeating-linear-gradient(45deg,#1a4731 0 6px,#235c3f 6px 12px)' }}
        whileHover={disabled ? {} : { y: -4 }}
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ delay: index * 0.06, type: 'spring', stiffness: 280, damping: 22 }}
      />
    )
  }

  const { value, suit } = card
  const isRed = RED_SUITS.has(suit)
  const symbol = SUIT_SYMBOLS[suit]
  const isFace = value in FACE_GLYPHS

  return (
    <motion.div
      layout
      className={`playing-card flex flex-col justify-between p-1.5
        ${small ? 'w-9 text-xs' : 'w-16 text-sm'}
        ${selected ? 'selected' : ''}
        ${disabled ? 'cursor-default' : ''}
      `}
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { y: small ? -3 : -8, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
      whileTap={disabled ? {} : { scale: 0.93 }}
      initial={isNew
        ? { scale: 1.25, y: -30, opacity: 0, rotateZ: -8 }
        : { rotateY: 90, opacity: 0 }
      }
      animate={{ scale: 1, y: selected ? -8 : 0, opacity: 1, rotateY: 0, rotateZ: 0 }}
      transition={{
        delay: isNew ? 0 : index * 0.06,
        type: 'spring',
        stiffness: 300,
        damping: 22,
      }}
      style={{ color: isRed ? '#dc2626' : '#111' }}
      title={`${value}${symbol}`}
    >
      {/* Top-left corner */}
      <div className="leading-none">
        <div className="font-bold">{value}</div>
        <div>{symbol}</div>
      </div>

      {/* Centre */}
      {!small && (
        <div className="text-center" style={{ fontSize: isFace ? '1.4rem' : '1.25rem', fontWeight: isFace ? 700 : 400 }}>
          {isFace ? value : symbol}
        </div>
      )}

      {/* Bottom-right (rotated) */}
      <div className="leading-none self-end rotate-180">
        <div className="font-bold">{value}</div>
        <div>{symbol}</div>
      </div>
    </motion.div>
  )
}
