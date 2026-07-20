/**
 * Full-screen celebration burst for an instant win (a hand of 31).
 *
 * Self-dismisses after ~2.8s via onDone so the caller only has to decide
 * *whether* to show it, not when to hide it.
 */

import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'

const SUITS = ['♠', '♥', '♦', '♣']
// On the dark overlay the black suits read as white; red stays red.
const SUIT_COLORS = { '♠': '#ffffff', '♥': '#ef4444', '♦': '#ef4444', '♣': '#ffffff' }

const PIECE_COUNT = 24
const DISMISS_AFTER_MS = 2800

export default function CelebrationOverlay({ message, onDone }) {
  // Randomised once per mount — regenerating each render would restart every
  // piece's animation on any parent re-render.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECE_COUNT }, (_, i) => ({
        id: i,
        suit: SUITS[i % 4],
        x: Math.random() * 100,
        delay: Math.random() * 0.6,
        rotate: Math.random() * 720 - 360,
        scale: 0.8 + Math.random() * 1.2,
        duration: 1.8 + Math.random() * 0.8,
      })),
    [],
  )

  useEffect(() => {
    const t = setTimeout(onDone, DISMISS_AFTER_MS)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="status"
      aria-live="polite"
    >
      <motion.div
        className="absolute inset-0 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0.4] }}
        transition={{ duration: 0.4 }}
      />

      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute select-none"
          style={{
            left: `${p.x}%`,
            top: '-5%',
            color: SUIT_COLORS[p.suit],
            fontSize: `${p.scale * 1.5}rem`,
          }}
          initial={{ y: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          aria-hidden="true"
        >
          {p.suit}
        </motion.span>
      ))}

      <motion.div
        className="relative z-10 text-center px-8 py-6 rounded-3xl bg-black/80 border-2 border-gold shadow-glow"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.15, 1], opacity: 1 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 260, damping: 18 }}
      >
        <div className="text-6xl mb-2" aria-hidden="true">🃏</div>
        <p className="text-gold-light font-bold text-2xl">{message}</p>
      </motion.div>
    </motion.div>
  )
}
