import { useEffect } from 'react'
import { useFlashSaleCountdown } from '../lib/useFlashSale'

/**
 * Live "ends in" timer for a flash sale, read from the shared app-wide clock
 * (useFlashSaleCountdown), so every countdown on screen shows the same time.
 * Only this component re-renders each second. onEnd fires once at zero.
 *
 * variant "card": compact, for the grid. variant "modal": label above the time.
 */
export default function FlashSaleCountdown({ endsAt, onEnd, variant = 'modal' }) {
  const { remaining, label } = useFlashSaleCountdown(endsAt)

  useEffect(() => {
    if (remaining === 0) onEnd?.()
  }, [remaining, onEnd])

  const time = (
    <time
      dateTime={new Date(endsAt).toISOString()}
      className="whitespace-nowrap font-mono font-semibold tabular-nums text-red-600 dark:text-red-400"
    >
      {label}
    </time>
  )

  if (variant === 'card') {
    return (
      <span className="flex flex-col items-end text-[10px] leading-tight" title="Flash sale ends in">
        <span className="font-semibold uppercase tracking-[0.15em] text-red-600 dark:text-red-400">Ends in</span>
        {time}
      </span>
    )
  }
  return (
    <span className="flex flex-col text-sm leading-tight">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-600 dark:text-red-400">
        Flash sale ends in
      </span>
      {time}
    </span>
  )
}
