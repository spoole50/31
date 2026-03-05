/**
 * Discard pile + draw deck controls.
 */

import { motion, AnimatePresence } from 'framer-motion'
import Card from './Card.jsx'

export default function DiscardPile({ topCard, deckSize, discardPileLength = 0, canDraw, onDrawDeck, onDrawDiscard }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white/40 text-xs uppercase tracking-wider">Table</p>

      <div className="flex items-end gap-6">
        {/* Draw deck */}
        <div className="flex flex-col items-center gap-2">
          <motion.button
            className={`playing-card back w-16 flex items-center justify-center
              ${canDraw ? 'cursor-pointer hover:shadow-glow' : 'opacity-40 cursor-default'}`}
            onClick={canDraw ? onDrawDeck : undefined}
            whileTap={canDraw ? { scale: 0.95 } : {}}
            title="Draw from deck"
          >
            <span className="text-white/20 text-xs font-mono">{deckSize}</span>
          </motion.button>
          {canDraw && (
            <button className="btn btn-secondary btn-sm" onClick={onDrawDeck}>
              Draw deck
            </button>
          )}
          {!canDraw && <span className="text-white/30 text-xs">Deck ({deckSize})</span>}
        </div>

        {/* Discard pile */}
        <div className="flex flex-col items-center gap-2">
          <AnimatePresence mode="wait">
            {topCard ? (
              <motion.div
                key={discardPileLength}
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Card card={topCard} disabled={!canDraw} onClick={canDraw ? onDrawDiscard : undefined} />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                className="w-16 border-2 border-dashed border-white/20 rounded-lg"
                style={{ aspectRatio: '2.5/3.5' }}
              />
            )}
          </AnimatePresence>
          {canDraw && topCard && (
            <button className="btn btn-secondary btn-sm" onClick={onDrawDiscard}>
              Take discard
            </button>
          )}
          {(!canDraw || !topCard) && <span className="text-white/30 text-xs">Discard</span>}
        </div>
      </div>
    </div>
  )
}
