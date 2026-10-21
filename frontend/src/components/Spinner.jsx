/**
 * Full-page loading state.
 */

export default function Spinner({ label }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4" role="status">
      <span
        className="w-8 h-8 rounded-full border-2 border-white/20 border-t-gold animate-spin"
        aria-hidden="true"
      />
      <p className="text-white/70 text-sm">{label}</p>
    </div>
  )
}
