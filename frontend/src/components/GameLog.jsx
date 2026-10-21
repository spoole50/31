/**
 * Scrolling game log.
 */

import { useEffect, useRef } from 'react'

export default function GameLog({ entries = [], className = 'h-32' }) {
  const scrollerRef = useRef(null)

  // Scroll the panel itself. scrollIntoView() on a bottom sentinel also
  // scrolled every ancestor — the whole page jumped down to the log each
  // time an entry arrived.
  useEffect(() => {
    const el = scrollerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])

  return (
    <div
      ref={scrollerRef}
      className={`surface bg-black/20 overflow-y-auto px-3 py-2 ${className}`}
      role="log"
      aria-label="Game log"
      tabIndex={0}
    >
      {entries.length === 0 ? (
        /* white/30 measured 2.69:1 against this panel; /55 is the AA floor. */
        <p className="text-white/55 text-xs text-center mt-8">Game log will appear here</p>
      ) : (
        entries.map((entry, i) => (
          <p key={i} className="text-white/70 text-xs py-0.5 leading-snug">
            {entry}
          </p>
        ))
      )}
    </div>
  )
}
