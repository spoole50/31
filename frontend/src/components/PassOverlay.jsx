/**
 * Pass-and-play handoff screen.
 *
 * Covers the board while the device changes hands so the next player never
 * sees the previous player's cards. Blocking is the whole point — it stays up
 * until the incoming player explicitly confirms.
 */

import { motion } from 'framer-motion'

export default function PassOverlay({ playerName, onConfirm }) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6 gap-8 bg-felt-dark/[0.97]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pass-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-center"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <div className="text-5xl mb-4" aria-hidden="true">📱</div>
        <h2 id="pass-title" className="text-3xl font-bold mb-2">Pass the device</h2>
        <p className="text-white/70 text-lg">
          Hand it to <span className="text-white font-semibold">{playerName}</span>
        </p>
      </motion.div>

      <motion.button
        className="btn btn-primary btn-lg px-10"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onConfirm}
        whileTap={{ scale: 0.95 }}
        autoFocus
      >
        I'm {playerName} — Show my hand
      </motion.button>
    </motion.div>
  )
}
