/**
 * Draw deck + discard pile.
 *
 * Each pile is a single tap target. The caption slot is always present and
 * fixed-height, so nothing moves when it becomes your turn. When you can
 * draw, both piles get a gold ring; previously only the deck changed (it
 * dimmed when you couldn't draw) and the discard pile gave no cue at all.
 */

import { motion, AnimatePresence } from 'framer-motion'
import Card, { cardName } from './Card.jsx'

const DRAWABLE = 'ring-2 ring-gold ring-offset-2 ring-offset-felt-dark rounded-lg'

/* white/55 is the floor that clears WCAG AA (4.5:1) against felt.dark;
   white/40 measured 3.60:1. */
function Caption({ children }) {
  return <span className="h-4 text-xs text-white/60 tabular-nums">{children}</span>
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
    <div className="flex items-start gap-6 sm:gap-10">
      {/* Draw deck */}
      <div className="flex flex-col items-center gap-2">
        <motion.button
          type="button"
          className={`playing-card back card-md flex items-center justify-center
            ${canDraw ? `interactive ${DRAWABLE}` : 'cursor-default'}`}
          onClick={canDraw ? onDrawDeck : undefined}
          disabled={!canDraw}
          whileHover={canDraw ? { y: -4 } : undefined}
          whileTap={canDraw ? { scale: 0.95 } : undefined}
          aria-label={canDraw ? `Draw from deck, ${deckSize} cards left` : `Deck, ${deckSize} cards left`}
        >
          {/* Sits on the felt card-back pattern, not the page background:
              white/20 measured 1.79:1 there. white/80 clears AA on both
              stripe tones. */}
          <span className="text-white/80 text-xs font-mono bg-felt-dark/60 rounded px-1.5 py-0.5">{deckSize}</span>
        </motion.button>
        <Caption>{canDraw ? 'Draw' : 'Deck'}</Caption>
      </div>

      {/* Discard pile */}
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait" initial={false}>
          {topCard ? (
            <motion.div
              key={discardPileLength}
              className={canDraw ? DRAWABLE : ''}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Card
                card={topCard}
                disabled={!canDraw}
                onClick={onDrawDiscard}
                label={canDraw
                  ? `Take ${cardName(topCard)} from the discard pile`
                  : `Discard pile: ${cardName(topCard)}`}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="card-md aspect-[2.5/3.5] border-2 border-dashed border-white/20 rounded-lg"
              role="img"
              aria-label="Discard pile is empty"
            />
          )}
        </AnimatePresence>
        <Caption>{canDraw && topCard ? 'Take' : 'Discard'}</Caption>
      </div>
    </div>
  )
}
