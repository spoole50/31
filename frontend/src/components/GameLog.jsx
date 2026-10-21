/**
 * Scrolling game log.
 */

import { useEffect, useRef } from 'react'

export default function GameLog({ entries = [] }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  return (
    <div className="surface bg-black/20 h-32 overflow-y-auto px-3 py-2">
      {entries.length === 0 ? (
        /* white/30 measured 2.69:1 against this panel; /55 is the AA floor. */
        <p className="text-white/55 text-xs text-center mt-8">Game log will appear here</p>
      ) : (
        entries.map((entry, i) => (
          <p key={i} className="text-white/60 text-xs py-0.5 leading-snug">
            {entry}
          </p>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  )
}
