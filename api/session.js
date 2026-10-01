import { findAsset } from '../src/data/catalogue.js'
import { HttpError, getStripe, sendError } from './_stripe.js'

/**
 * GET /api/session?session_id=cs_test_...
 *
 * Lets the success page confirm with Stripe that a session was actually paid
 * before it records a sale, so visiting /success directly cannot fake one.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      throw new HttpError(405, 'Use GET.')
    }

    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : ''
    if (!/^cs_test_[A-Za-z0-9]+$/.test(sessionId)) throw new HttpError(400, 'Invalid session id.')

    let session
    try {
      session = await getStripe().checkout.sessions.retrieve(sessionId)
    } catch (error) {
      if (error?.type === 'StripeInvalidRequestError') throw new HttpError(404, 'Checkout session not found.')
      throw error
    }

    const asset = findAsset(session.metadata?.assetId ?? '')
    res.status(200).json({
      id: session.id,
      paid: session.payment_status === 'paid',
      assetId: asset?.id ?? null,
      title: asset?.title ?? 'Premium asset',
      amount: (session.amount_total ?? 0) / 100,
      currency: (session.currency ?? 'aud').toUpperCase(),
      email: session.customer_details?.email ?? null,
    })
  } catch (error) {
    sendError(res, error)
  }
}
