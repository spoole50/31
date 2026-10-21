/**
 * Transient notification.
 *
 * Exists because socket-level feedback used to go nowhere: `onlineError` was
 * only rendered on the lobby screens (so an error mid-game was silent), and
 * `turn_timeout` was a console.info. Both now surface here.
 */

import { useEffect } from 'react'
import { motion } from 'framer-motion'

const TONES = {
  error: 'bg-red-600/90 border-red-400/50',
  info: 'bg-black/85 border-white/20',
}

export default function Toast({ message, tone = 'info', onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!duration) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [duration, onDismiss, message])

  return (
    <motion.div
      className="fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pointer-events-none"
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -24, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div
        className={`pointer-events-auto flex items-center gap-3 max-w-sm w-full
          rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${TONES[tone]}`}
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live={tone === 'error' ? 'assertive' : 'polite'}
      >
        <span className="flex-1">{message}</span>
        <button
          onClick={onDismiss}
          className="-my-2 -mr-2 w-9 h-9 shrink-0 text-white/70 hover:text-white transition-colors text-lg leading-none"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </motion.div>
  )
}
