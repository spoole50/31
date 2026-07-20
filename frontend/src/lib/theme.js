/**
 * Palette access for the handful of places that need a colour as a JS value
 * rather than a class — SVG stroke attributes, canvas-style gradients, and
 * Framer Motion animated properties.
 *
 * Re-exported from tailwind.config.js so there is exactly one place a colour
 * is ever defined. Never hardcode a hex in a component; import from here.
 */

import tailwindConfig from '../../tailwind.config.js'

const { colors } = tailwindConfig.theme.extend

export const felt = colors.felt
export const gold = colors.gold
export const card = colors.card

/** Suit glyph colours — red suits vs black suits on a white card face. */
export const SUIT_INK = {
  red: '#dc2626',
  black: '#111111',
}

/** Turn-timer ring colour, escalating as the clock runs down. */
export function timerColor(secondsRemaining) {
  if (secondsRemaining <= 10) return '#ef4444' // red-500
  if (secondsRemaining <= 20) return '#f97316' // orange-500
  return gold.DEFAULT
}
