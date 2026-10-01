import Stripe from 'stripe'

/**
 * Shared Stripe client for the API routes (files starting with `_` are not
 * exposed as routes by Vercel).
 *
 * This project is a university demo, so it only ever talks to Stripe in TEST
 * mode: a live secret key is refused outright rather than risking real charges.
 */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new HttpError(500, 'Stripe is not configured (missing STRIPE_SECRET_KEY).')
  }
  if (!/^(sk|rk)_test_/.test(key)) {
    throw new HttpError(500, 'Refusing to run: STRIPE_SECRET_KEY is not a test-mode key.')
  }
  return new Stripe(key)
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/** The site's own origin, so redirects work on production and preview URLs alike. */
export function siteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'https'
  return `${proto}://${req.headers.host}`
}

export function sendError(res, error) {
  const status = error instanceof HttpError ? error.status : 500
  if (status === 500) console.error(error)
  res.status(status).json({ error: error instanceof HttpError ? error.message : 'Unexpected server error.' })
}
