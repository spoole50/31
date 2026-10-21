/**
 * Turn timer — visual countdown ring + seconds.
 */

import { useEffect, useRef, useState } from 'react'
import { timerColor } from '../lib/theme.js'

const TOTAL = 45

export default function TurnTimer({ timeRemaining, isMyTurn, show = true, onExpire }) {
  const [local, setLocal] = useState(timeRemaining)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  useEffect(() => { onExpireRef.current = onExpire }, [onExpire])

  // Sync when server pushes a new timestamp; reset expiry guard
  useEffect(() => {
    setLocal(timeRemaining)
    expiredRef.current = false
  }, [timeRemaining])

  // Tick down locally every second for smooth animation
  useEffect(() => {
    if (!isMyTurn) return
    const id = setInterval(() => {
      setLocal((t) => {
        const next = Math.max(0, t - 1)
        if (next === 0 && !expiredRef.current) {
          expiredRef.current = true
          onExpireRef.current?.()
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isMyTurn])

  // Bail out *after* the hooks above — an early return before them would make
  // the hook order depend on `show` and violate the rules of hooks.
  if (!show) return null

  const pct = Math.max(0, local / TOTAL)
  const r = 20
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  const color = timerColor(local)

  return (
    <div className="relative inline-flex items-center justify-center" title={`${local}s remaining`}>
      <svg width={52} height={52} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
        {/* Progress */}
        <circle
          cx={26}
          cy={26}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span
        className="absolute text-sm font-bold"
        style={{ color }}
      >
        {local}
      </span>
    </div>
  )
}
