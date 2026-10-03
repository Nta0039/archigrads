import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CircleAlert, CircleCheck, Download, LoaderCircle } from 'lucide-react'
import { formatAud } from '../lib/catalogue'
import { downloadAsset } from '../lib/download'
import { recordSale } from '../lib/sales'
import FeedbackModal from './FeedbackModal'

/**
 * Stripe redirects here after checkout (/success?session_id=cs_test_...). The
 * page asks /api/session whether the session was really paid, records the sale
 * for the admin dashboard, and offers the files via signed links from
 * /api/download (which re-checks the payment for the private file).
 */
export default function SuccessPage({ onBack }) {
  const [state, setState] = useState({ status: 'loading' })
  const [showFeedback, setShowFeedback] = useState(false)
  const [download, setDownload] = useState({ status: 'idle', message: '' })
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

  const startDownload = async () => {
    setDownload({ status: 'loading', message: '' })
    try {
      await downloadAsset(state.session.assetId, state.session.id)
      setDownload({ status: 'idle', message: '' })
    } catch (error) {
      console.error('[download] Could not download the purchase:', error)
      setDownload({ status: 'error', message: error.message })
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6 py-20">
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center sm:p-10 dark:border-neutral-800 dark:bg-neutral-900">
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

            <dl className="mx-auto mt-8 grid max-w-sm grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200 text-left text-sm dark:border-neutral-800 dark:bg-neutral-800">
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
              <button
                type="button"
                onClick={startDownload}
                disabled={download.status === 'loading'}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-md bg-neutral-900 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-80 sm:w-auto sm:px-8 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {download.status === 'loading' ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden />
                ) : (
                  <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                )}
                {download.status === 'loading' ? 'Preparing your files…' : 'Download Your Files'}
              </button>
            )}
            {download.status === 'error' && (
              <p role="alert" className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                {download.message}
              </p>
            )}
            <p className="mt-3 text-[11px] text-neutral-400 dark:text-neutral-500">
              Stripe test mode: no real money was charged. Files are preview placeholders.
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
