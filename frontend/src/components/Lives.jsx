/**
 * Remaining lives as a row of dots, with a text equivalent for screen readers.
 */

const MAX_LIVES = 3

export default function Lives({ lives, className = '' }) {
  const left = Math.max(0, lives)
  return (
    <span
      className={`inline-flex gap-1 ${className}`}
      role="img"
      aria-label={`${left} ${left === 1 ? 'life' : 'lives'} left`}
    >
      {Array.from({ length: MAX_LIVES }, (_, i) => (
        <span key={i} className={`life-dot ${i < left ? 'active' : 'lost'}`} />
      ))}
    </span>
  )
}
