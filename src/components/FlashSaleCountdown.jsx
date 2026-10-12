import { useEffect, useState } from 'react'

const pad = (value) => String(value).padStart(2, '0')

/**
 * "Flash Sale Ends In: 4d 12h 34m 12s", ticking once a second. Only this small
 * component re-renders each tick; onEnd fires once the time reaches zero so
 * the parent can switch back to the normal price.
 */
export default function FlashSaleCountdown({ endsAt, onEnd }) {
  const [now, setNow] = useState(() => Date.now())
  const remaining = Math.max(0, endsAt - now)

  useEffect(() => {
    if (remaining === 0) {
      onEnd?.()
      return undefined
    }
    // Align ticks to whole seconds so the display never skips a second.
    const timer = setTimeout(() => setNow(Date.now()), 1000 - (Date.now() % 1000) + 5)
    return () => clearTimeout(timer)
  }, [now, remaining, onEnd])

  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return (
    <p className="flex items-baseline justify-between gap-3 border-t border-red-600/40 px-3 py-2 dark:border-red-400/40">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
        Flash sale ends in
      </span>
      <time
        dateTime={new Date(endsAt).toISOString()}
        aria-live="off"
        className="font-mono text-sm font-semibold tabular-nums text-red-600 dark:text-red-400"
      >
        {days}d {pad(hours)}h {pad(minutes)}m {pad(seconds)}s
      </time>
    </p>
  )
}
