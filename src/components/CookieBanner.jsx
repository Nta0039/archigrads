import { useEffect, useState } from 'react'
import { Cookie, X } from 'lucide-react'

const STORAGE_KEY = 'archigrads_cookie_consent'

function readChoice() {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null // storage blocked (e.g. private mode): treat as not yet answered
  }
}

/**
 * Cookie notice, bottom-left. Presentational only: the site sets no tracking
 * cookies. The visitor's choice ('accepted' / 'declined') is remembered in
 * localStorage so the banner shows once per browser.
 */
export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (readChoice()) return undefined
    // A short delay, so it slides in after the page has painted.
    const timer = setTimeout(() => setIsVisible(true), 600)
    return () => clearTimeout(timer)
  }, [])

  const choose = (choice) => {
    try {
      localStorage.setItem(STORAGE_KEY, choice)
    } catch {
      // Not saved (storage blocked); hidden for this visit only.
    }
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <section
      role="region"
      aria-label="Cookie notice"
      className="fade-in fixed inset-x-4 bottom-4 z-50 border-2 border-neutral-950 bg-white text-neutral-950 shadow-2xl shadow-neutral-950/25 sm:right-auto sm:w-[22rem] dark:border-white dark:bg-neutral-950 dark:text-white dark:shadow-black/60"
    >
      <div className="flex items-center justify-between border-b-2 border-neutral-950 px-4 py-2 dark:border-white">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em]">
          <Cookie className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Cookies
        </p>
        <button
          type="button"
          onClick={() => choose('declined')}
          aria-label="Decline and close"
          className="-mr-1 p-1 text-neutral-500 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <p className="px-4 pt-3 text-sm leading-relaxed">
        We use strictly necessary cookies to ensure our architectural asset library functions properly. No tracking,
        just building.
      </p>
      <div className="grid grid-cols-2 gap-2 p-4">
        <button
          type="button"
          onClick={() => choose('declined')}
          className="border-2 border-neutral-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-neutral-100 dark:border-white dark:hover:bg-neutral-800"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => choose('accepted')}
          className="border-2 border-neutral-950 bg-neutral-950 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-neutral-700 dark:border-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-300"
        >
          Accept
        </button>
      </div>
    </section>
  )
}
