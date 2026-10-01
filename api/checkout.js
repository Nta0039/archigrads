import { findAsset } from '../src/data/catalogue.js'
import { HttpError, getStripe, sendError, siteOrigin } from './_stripe.js'

/**
 * POST /api/checkout  { assetId }  ->  { url }
 *
 * Creates a Stripe Checkout Session for one premium asset. The price is looked
 * up here from the shared catalogue, never taken from the request, so a visitor
 * cannot change what they pay.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      throw new HttpError(405, 'Use POST.')
    }

    const assetId = typeof req.body?.assetId === 'string' ? req.body.assetId : ''
    const asset = findAsset(assetId)
    if (!asset) throw new HttpError(404, 'Unknown asset.')
    if (!asset.price) throw new HttpError(400, 'This asset is free; no checkout needed.')

    const origin = siteOrigin(req)
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'aud',
            unit_amount: asset.price * 100,
            product_data: {
              name: asset.title,
              description: `${asset.type} · ${asset.allowance}`,
            },
          },
        },
      ],
      metadata: { assetId: asset.id },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    })

    res.status(200).json({ url: session.url })
  } catch (error) {
    sendError(res, error)
  }
}
