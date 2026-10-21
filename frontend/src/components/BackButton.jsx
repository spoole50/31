/**
 * "← Back" link-style button used at the top of the setup and lobby pages.
 */

import { useNavigate } from 'react-router-dom'

export default function BackButton({ to, label = 'Back', onClick }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="text-white/70 text-sm mb-4 -ml-2 px-2 min-h-[2.75rem] inline-flex items-center gap-1 rounded-lg hover:text-white transition-colors"
      onClick={onClick ?? (() => navigate(to))}
    >
      <span aria-hidden="true">←</span> {label}
    </button>
  )
}
