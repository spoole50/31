/**
 * Accessible modal shell: backdrop, bottom sheet on phones / centred card on
 * wider screens.
 *
 * Handles the parts every dialog needs and none of ours had: dialog
 * semantics, Escape to close, focus moved in on open and restored on close,
 * Tab kept inside the panel, and the page behind locked from scrolling.
 *
 * Props:
 *   open         bool
 *   onClose      fn      — omit for a dialog that must be answered
 *   labelledBy   string  — id of the element that titles the dialog
 *   className    string  — extra classes for the panel
 */

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export default function Modal({ open, onClose, labelledBy, className = '', children }) {
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus the first control, or the panel itself if it has none
    const panel = panelRef.current
    const first = panel?.querySelector('[autofocus], [data-autofocus]') ?? panel?.querySelector(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll(FOCUSABLE)]
      if (items.length === 0) { e.preventDefault(); return }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstItem) { e.preventDefault(); lastItem.focus() }
      else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); firstItem.focus() }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
            px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Closing is quick, and stops catching clicks at once, so a tap
          // right after dismissing lands on the page rather than the fading
          // backdrop.
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.15 } }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            className={`relative w-full max-w-md max-h-[85dvh] overflow-y-auto outline-none
              bg-felt-dark border border-white/15 rounded-2xl p-6 shadow-2xl ${className}`}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
