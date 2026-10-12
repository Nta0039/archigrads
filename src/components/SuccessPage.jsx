import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, CircleAlert, CircleCheck, Download, LoaderCircle } from 'lucide-react'
import { formatAud } from '../lib/catalogue'
import { downloadAsset } from '../lib/download'
import { recordSale } from '../lib/sales'
import FeedbackModal from './FeedbackModal'
import { FEEDBACK_FORM_URL } from '../lib/feedback'

/**
 * Stripe redirects here after checkout (/success?session_id=cs_...). The
 * page asks /api/session whether the session was really paid, records the sale
 * for the admin dashboard, and offers the files via signed links from
 * /api/download (which re-checks the payment for the private file).
 */
export default function SuccessPage({ onBack }) {
  const [state, setState] = useState({ status: 'loading' })
  const [showFeedback, setShowFeedback] = useState(false)
  const [download, setDownload] = useState({ status: 'idle', message: '' }) // idle | loading | done | error
  const autoStarted = useRef(false) // survives Strict Mode's double effect run
  const closeFeedback = useCallback(() => setShowFeedback(false), [])

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (!sessionId) {
      setState({ status: 'error', message: 'No checkout session was found in this link.' })
      return
    }

    let cancelled = false
    fetch(`/api/session?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not confirm the payment.')
        return data
      })
      .then((session) => {
        if (cancelled) return
        if (!session.paid) {
          setState({ status: 'error', message: 'This checkout has not been paid yet.' })
          return
        }
        recordSale({
          sessionId: session.id,
          assetId: session.assetId,
          title: session.title,
          amount: session.amount,
          email: session.email,
          livemode: session.livemode,
        })
        setState({ status: 'paid', session })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error.message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Invite feedback shortly after a confirmed payment, once per checkout (a
  // reload of the same success page does not ask again).
  const paidSessionId = state.status === 'paid' ? state.session.id : null
  useEffect(() => {
    if (!paidSessionId) return undefined
    const seenKey = `archigrads-feedback-asked-${paidSessionId}`
    try {
      if (sessionStorage.getItem(seenKey)) return undefined
    } catch {
      // Storage blocked: just show the invitation.
    }
    const timer = setTimeout(() => {
      setShowFeedback(true)
      try {
        sessionStorage.setItem(seenKey, '1')
      } catch {
        // Ignore: worst case the invitation shows again after a reload.
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [paidSessionId])

  // A bundle unlocks several assets; they download one after another.
  // downloadAsset fetches each signed Supabase URL as a blob and saves it via a
  // same-origin blob link, which forces a real download (the download attribute
  // is ignored on cross-origin links).
  const startDownload = useCallback(async (session) => {
    const ids = session.assetIds?.length ? session.assetIds : [session.assetId]
    try {
      for (const [index, id] of ids.entries()) {
        setDownload({ status: 'loading', message: '', progress: ids.length > 1 ? `${index + 1} of ${ids.length}` : '' })
        await downloadAsset(id, session.id)
      }
      setDownload({ status: 'done', message: '' })
    } catch (error) {
      console.error('[download] Could not download the purchase:', error)
      setDownload({ status: 'error', message: error.message })
    }
  }, [])

  // Start the download by itself once the payment is confirmed, exactly once
  // per page load, so closing the tab early cannot lose the purchase.
  const paidSession = state.status === 'paid' ? state.session : null
  useEffect(() => {
    if (!paidSession?.hasSource || autoStarted.current) return
    autoStarted.current = true
    startDownload(paidSession)
  }, [paidSession, startDownload])

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6 py-20">
      <div className="border border-neutral-200 bg-white p-8 text-center sm:p-10 dark:border-neutral-800 dark:bg-neutral-900">
        {state.status === 'loading' && (
          <>
            <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-neutral-400" strokeWidth={1.5} aria-hidden />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">This only takes a moment.</p>
          </>
        )}

        {state.status === 'error' && (
          <>
            <CircleAlert className="mx-auto h-10 w-10 text-neutral-400" strokeWidth={1.5} aria-hidden />
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">We couldn't confirm this payment</h1>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">{state.message}</p>
          </>
        )}

        {state.status === 'paid' && (
          <div className="fade-in">
            <CircleCheck className="mx-auto h-12 w-12 text-neutral-900 dark:text-neutral-100" strokeWidth={1.5} aria-hidden />
            <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-400 dark:text-neutral-500">
              Payment Successful
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Thank you!</h1>
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              Your purchase of <span className="font-medium text-neutral-900 dark:text-neutral-100">{state.session.title}</span>{' '}
              is confirmed.
              {state.session.email && <> A receipt is on its way to {state.session.email}.</>}
            </p>

            <dl className="mx-auto mt-8 grid max-w-sm grid-cols-2 gap-px overflow-hidden border border-neutral-200 bg-neutral-200 text-left text-sm dark:border-neutral-800 dark:bg-neutral-800">
              <div className="bg-neutral-50 px-4 py-3 dark:bg-neutral-950">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">Amount paid</dt>
                <dd className="mt-1 font-semibold tabular-nums">{formatAud(state.session.amount)} AUD</dd>
              </div>
              <div className="bg-neutral-50 px-4 py-3 dark:bg-neutral-950">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">Allowance</dt>
                <dd className="mt-1 font-semibold">{state.session.allowance ?? '—'}</dd>
              </div>
            </dl>

            {state.session.hasSource && (
              // Auto-download status plus a manual button, for browsers that block
              // downloads that start without a click.
              <div className="mx-auto mt-8 max-w-sm text-left">
                <p
                  role={download.status === 'error' ? 'alert' : 'status'}
                  className="flex items-start gap-2 border-2 border-b-0 border-neutral-950 px-4 py-2.5 text-xs leading-snug text-neutral-600 dark:border-white dark:text-neutral-300"
                >
                  {download.status === 'loading' ? (
                    <LoaderCircle className="mt-px h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={2} aria-hidden />
                  ) : download.status === 'error' ? (
                    <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  ) : (
                    <Download className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  )}
                  <span>
                    {download.status === 'loading'
                      ? `Your download is starting${download.progress ? ` (file ${download.progress})` : ''}…`
                      : download.status === 'done'
                        ? "Download started. Check your browser's downloads; if nothing arrived, use the button below."
                        : download.status === 'error'
                          ? `${download.message} Use the button below.`
                          : 'Your download will start automatically.'}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => startDownload(state.session)}
                  disabled={download.status === 'loading'}
                  className="flex w-full items-center justify-center gap-2 border-2 border-neutral-950 bg-neutral-950 px-6 py-4 text-sm font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-80 dark:border-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Download Asset Now
                </button>
              </div>
            )}

            {/* Always available here, even after the feedback pop-up is dismissed. */}
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group mx-auto mt-3 flex max-w-sm items-center justify-between gap-4 border border-neutral-300 px-4 py-3 text-left text-sm transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100"
            >
              <span>
                <span className="block text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-400 dark:text-neutral-500">
                  Help us improve
                </span>
                <span className="mt-1 block font-medium text-neutral-900 dark:text-neutral-100">Take a 1-minute survey</span>
              </span>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neutral-900 dark:group-hover:text-neutral-100"
                strokeWidth={1.75}
                aria-hidden
              />
            </a>

            <p className="mt-6 text-[11px] text-neutral-400 dark:text-neutral-500">
              {state.session.livemode
                ? 'Paid securely with Stripe. Your card statement will show this purchase.'
                : 'Stripe test mode: no real money was charged.'}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onBack}
          className="mt-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Back to library
        </button>
      </div>

      {showFeedback && <FeedbackModal onClose={closeFeedback} />}
    </main>
  )
}
