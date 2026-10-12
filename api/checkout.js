import { BUNDLES, bundleForListing } from '../src/lib/bundles.js'
import { fetchAsset } from '../src/lib/catalogue.js'
import { flashSale } from '../src/lib/pricing.js'
import { HttpError, getStripe, sendError, siteOrigin } from './_stripe.js'
import { getSupabaseAdmin } from './_supabase.js'

/** What is being bought: { item: { name, description, amountCents }, metadata }. */
async function readPurchase(body) {
  const supabase = getSupabaseAdmin()
  // A bundle's library card (e.g. "Old People's Home [Bundle]") is bought as that bundle.
  const listing = typeof body?.assetId === 'string' ? bundleForListing(body.assetId) : null

  if (body?.bundleId !== undefined || listing) {
    const bundle = listing ?? (typeof body.bundleId === 'string' ? BUNDLES[body.bundleId] : null)
    if (!bundle) throw new HttpError(404, 'Unknown bundle.')
    // Every file in the bundle must still be listed and downloadable.
    const assets = await Promise.all(bundle.assetIds.map((id) => fetchAsset(supabase, id)))
    if (assets.some((asset) => !asset?.hasSource)) throw new HttpError(409, 'This bundle is not available right now.')
    return {
      item: {
        name: bundle.title,
        description: `${assets.length} files: ${assets.map((asset) => asset.title).join(', ')}`,
        amountCents: bundle.priceCents,
      },
      metadata: { bundleId: bundle.id },
    }
  }

  const assetId = typeof body?.assetId === 'string' ? body.assetId : ''
  if (!/^[a-z0-9-]{1,100}$/.test(assetId)) throw new HttpError(404, 'Unknown asset.')
  const asset = await fetchAsset(supabase, assetId)
  if (!asset) throw new HttpError(404, 'Unknown asset.')
  if (!asset.price) throw new HttpError(400, 'This asset is free; no checkout needed.')
  // Weekly flash sale (src/lib/pricing.js), decided by the server's clock at
  // the moment the session is created.
  const normalCents = Math.round(asset.price * 100)
  const sale = flashSale(asset.id, normalCents)
  return {
    item: {
      name: asset.title,
      description: [asset.allowance ? `${asset.type} · ${asset.allowance}` : asset.type, sale?.active && 'Weekday flash sale']
        .filter(Boolean)
        .join(' · '),
      amountCents: sale ? sale.priceCents : normalCents,
    },
    metadata: { assetId: asset.id },
  }
}

/**
 * POST /api/checkout  { assetId } | { bundleId }  ->  { url }
 *
 * Creates a Stripe Checkout Session for one premium asset, or for a bundle
 * (src/lib/bundles.js). The price is read here (Supabase for an asset, the
 * bundle definition for a bundle), never taken from the request, so a visitor
 * cannot change what they pay.
 * Redirect URLs use the domain the visitor is on (production, preview or a
 * custom domain); test vs live mode comes only from STRIPE_SECRET_KEY.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      throw new HttpError(405, 'Use POST.')
    }

    const { item, metadata } = await readPurchase(req.body)
    const origin = siteOrigin(req)
    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'aud',
            unit_amount: item.amountCents,
            product_data: { name: item.name, description: item.description },
          },
        },
      ],
      metadata,
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    })

    res.status(200).json({ url: session.url })
  } catch (error) {
    sendError(res, error)
  }
}
