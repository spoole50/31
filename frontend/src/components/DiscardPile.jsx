/**
 * Draw deck + discard pile.
 *
 * Each pile is a single tap target. It previously rendered both a clickable
 * card *and* a separate button for the same action, and swapped that button
 * for a caption depending on `canDraw` — which shifted the layout every turn.
 * The caption slot is now always present and fixed-height, so nothing moves.
 */

import { motion, AnimatePresence } from 'framer-motion'
import Card from './Card.jsx'

function Caption({ children }) {
  return <span className="h-4 text-xs text-white/40 tabular-nums">{children}</span>
}

export default function DiscardPile({
  topCard,
  deckSize,
  discardPileLength = 0,
  canDraw,
  onDrawDeck,
  onDrawDiscard,
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-white/40 text-xs uppercase tracking-wider">Table</p>

      <div className="flex items-start gap-6">
        {/* Draw deck */}
        <div className="flex flex-col items-center gap-2">
          <motion.button
            type="button"
            className={`playing-card back w-16 flex items-center justify-center
              ${canDraw ? 'cursor-pointer hover:shadow-glow' : 'opacity-40 cursor-default'}`}
            onClick={canDraw ? onDrawDeck : undefined}
            disabled={!canDraw}
            whileTap={canDraw ? { scale: 0.95 } : {}}
            aria-label={
              canDraw ? `Draw from deck, ${deckSize} cards left` : `Deck, ${deckSize} cards left`
            }
          >
            <span className="text-white/20 text-xs font-mono">{deckSize}</span>
          </motion.button>
          <Caption>{canDraw ? 'Tap to draw' : `Deck (${deckSize})`}</Caption>
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
                aria-label="Discard pile is empty"
              />
            )}
          </AnimatePresence>
          <Caption>{canDraw && topCard ? 'Tap to take' : 'Discard'}</Caption>
        </div>
      </div>
    </div>
  )
}
