/**
 * Turn timer — visual countdown ring + seconds.
 *
 * Props:
 *   timeRemaining  number  — seconds, as last reported by the server
 *   running        bool    — tick down locally. Online this is true for every
 *                            turn (the clock was frozen on opponents' turns
 *                            before); local play pauses it during a handoff.
 *   isMyTurn       bool    — onExpire only fires on your own turn
 *   onExpire       fn
 *
 * Give it a `key` per turn: a new turn can report the same number as the
 * last update (45 → 45), which would not re-sync the local countdown.
 */

import { useEffect, useRef, useState } from 'react'
import { timerColor } from '../lib/theme.js'

const TOTAL = 45
const URGENT = 10

export default function TurnTimer({ timeRemaining, running, isMyTurn, onExpire }) {
  const [local, setLocal] = useState(timeRemaining)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  const isMyTurnRef = useRef(isMyTurn)
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])
  useEffect(() => { isMyTurnRef.current = isMyTurn }, [isMyTurn])

  // Sync when the server pushes a new value; reset the expiry guard
  useEffect(() => {
    setLocal(timeRemaining)
    expiredRef.current = false
  }, [timeRemaining])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setLocal((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [running])

  // Fire outside the state updater: updaters must stay pure (StrictMode runs
  // them twice).
  useEffect(() => {
    if (local === 0 && running && isMyTurnRef.current && !expiredRef.current) {
      expiredRef.current = true
      onExpireRef.current?.()
    }
  }, [local, running])

  const pct = Math.max(0, local / TOTAL)
  const r = 18
  const size = 44
  const c = size / 2
  const circ = 2 * Math.PI * r
  const color = timerColor(local)
  const urgent = isMyTurn && local <= URGENT

  return (
    <div
      className={`relative inline-flex items-center justify-center ${urgent ? 'animate-pulse' : ''}`}
      role="timer"
      aria-label={`${local} seconds left in ${isMyTurn ? 'your' : 'this'} turn`}
      title={`${local}s remaining`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={`${circ * pct} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums" style={{ color }} aria-hidden="true">
        {local}
      </span>
    </div>
  )
}
