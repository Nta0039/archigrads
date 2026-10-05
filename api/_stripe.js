import Stripe from 'stripe'

/**
 * Shared Stripe client for the API routes (files starting with `_` are not
 * exposed as routes by Vercel).
 *
 * Test or live mode is decided only by which secret key is configured in
 * Vercel (sk_test_... or sk_live_...); nothing in the code forces either.
 */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new HttpError(500, 'Stripe is not configured (missing STRIPE_SECRET_KEY).')
  }
  if (!/^(sk|rk)_(test|live)_/.test(key)) {
    // Catches the common mistake of pasting the publishable key (pk_...).
    throw new HttpError(500, 'STRIPE_SECRET_KEY must be a secret key (sk_test_... or sk_live_...).')
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
