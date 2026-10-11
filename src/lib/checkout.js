import { useState } from 'react'

/**
 * POSTs to the /api/checkout serverless function and returns the Stripe-hosted
 * checkout URL. Every failure becomes an Error whose message says what actually
 * went wrong (network, missing API route, or the server's own error message).
 */
async function createCheckoutSession(assetId) {
  let response
  try {
    response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId }),
    })
  } catch (networkError) {
    throw new Error(`Network error reaching /api/checkout: ${networkError.message}`, { cause: networkError })
  }

  const body = await response.text()
  let data = null
  try {
    data = JSON.parse(body)
  } catch {
    // Not JSON: usually an HTML 404 page because the API route isn't running.
  }

  if (!response.ok) {
    if (data?.error) throw new Error(data.error)
    if (response.status === 404) {
      // `npm run dev` (plain Vite) does not run Vercel functions in /api.
      throw new Error(
        'Checkout API not found. Test on the live site or run `vercel dev` locally; `npm run dev` has no /api.',
      )
    }
    throw new Error(`Checkout API returned HTTP ${response.status}: ${body.slice(0, 120)}`)
  }
  if (!data?.url) throw new Error(`Checkout API returned no checkout URL: ${body.slice(0, 120)}`)
  return data.url
}

/** Starts Stripe Checkout for one asset and redirects; exposes loading / error state. */
export function useCheckout(asset) {
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'error'
  const [message, setMessage] = useState('')

  const start = async () => {
    setStatus('loading')
    setMessage('')
    try {
      const url = await createCheckoutSession(asset.id)
      window.location.assign(url)
    } catch (error) {
      console.error('[checkout] Could not start Stripe Checkout:', error)
      setMessage(error.message)
      setStatus('error')
    }
  }

  return { status, message, start }
}
