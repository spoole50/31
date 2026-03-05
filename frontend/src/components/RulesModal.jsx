/**
 * Rules modal — Tailwind version.
 */

import { motion, AnimatePresence } from 'framer-motion'

export default function RulesModal({ open, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="relative w-full max-w-md max-h-[85vh] overflow-y-auto
              bg-felt-800 border border-white/10 rounded-2xl p-6 space-y-5"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">🎴 How to Play — 31</h2>
              <button
                className="text-white/40 hover:text-white transition-colors text-2xl leading-none"
                onClick={onClose}
              >
                ×
              </button>
            </div>

            <section>
              <h3 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-2">
                Objective
              </h3>
              <p className="text-white/70 text-sm">
                Get the highest total value of cards <strong className="text-white">in the same suit</strong>. A perfect score of 31 wins the round immediately.
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-2">
                Card Values
              </h3>
              <ul className="text-sm text-white/70 space-y-1">
                <li><span className="text-white font-medium">Ace</span> — 11 pts</li>
                <li><span className="text-white font-medium">King, Queen, Jack</span> — 10 pts each</li>
                <li><span className="text-white font-medium">2 – 10</span> — face value</li>
                <li><span className="text-white font-medium">Three Aces</span> — counts as 31</li>
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-2">
                On Your Turn
              </h3>
              <ol className="text-sm text-white/70 space-y-1 list-decimal list-inside">
                <li>Draw a card from the <strong className="text-white">deck</strong> or <strong className="text-white">discard pile</strong></li>
                <li>Discard one card from your hand</li>
                <li>Or <strong className="text-white">Knock</strong> to trigger the final round</li>
              </ol>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-2">
                Knocking
              </h3>
              <p className="text-sm text-white/70">
                When you knock, every other player gets <strong className="text-white">one final turn</strong>, then all hands are revealed. The lowest scorer loses a life.
              </p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gold-400 uppercase tracking-wider mb-2">
                Lives & Winning
              </h3>
              <ul className="text-sm text-white/70 space-y-1">
                <li>Each player starts with <strong className="text-white">3 lives</strong></li>
                <li>Lowest scorer each round loses a life</li>
                <li>If two players tie for lowest, <strong className="text-white">both</strong> lose a life</li>
                <li>A player who scores 31 means <strong className="text-white">everyone else</strong> loses a life</li>
                <li>Last player with lives remaining <strong className="text-white">wins</strong></li>
              </ul>
            </section>

            <button className="btn btn-primary w-full mt-2" onClick={onClose}>
              Got it — Let's Play! 🎮
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
