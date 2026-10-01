import { useEffect, useRef } from 'react'
import { ExternalLink, MessageSquareHeart, X } from 'lucide-react'

const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSekOcd8UHVAABwHoaBppHkP19gENGNGiTeneVYI0mbSXtkA5w/viewform'

/** Post-purchase survey invitation shown on the success page. */
export default function FeedbackModal({ onClose }) {
  const primaryRef = useRef(null)

  useEffect(() => {
    primaryRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        aria-describedby="feedback-body"
        className="relative w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 shadow-2xl shadow-neutral-950/10 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>

        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          <MessageSquareHeart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>

        <h2 id="feedback-title" className="mt-6 text-xl font-semibold tracking-tight">
          Thank you for supporting ArchiGrads
        </h2>
        <div id="feedback-body" className="mt-3 space-y-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          <p>
            Every purchase helps a small, student-built platform keep growing, and we're genuinely grateful you chose
            to be part of it.
          </p>
          <p>
            Would you spare two minutes for a quick survey? Your honest thoughts on what worked, and what didn't, will
            directly shape the assets and services we build next for the architecture community.
          </p>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2.5 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            Maybe later
          </button>
          <a
            ref={primaryRef}
            href={FEEDBACK_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Share Feedback
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </a>
        </div>
        <p className="mt-4 text-center text-[11px] text-neutral-400 sm:text-right dark:text-neutral-500">
          Opens a short Google Form in a new tab.
        </p>
      </div>
    </div>
  )
}
