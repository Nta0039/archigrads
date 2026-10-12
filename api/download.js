import { BUNDLES } from '../src/lib/bundles.js'
import { SOURCE_BUCKET, fetchAsset } from '../src/lib/catalogue.js'
import { HttpError, getStripe, sendError } from './_stripe.js'
import { getSupabaseAdmin } from './_supabase.js'

const LINK_LIFETIME_SECONDS = 300

/**
 * GET /api/download?asset=<slug>[&session_id=cs_...]  ->  { filename, urls }
 *
 * Source files live in the private "source-files" bucket. This returns signed
 * links that expire after five minutes:
 *   - free assets: for anyone;
 *   - premium assets: only with a Stripe Checkout session that is paid and was
 *     for this exact asset, or for a bundle that includes it.
 * Several urls means a file stored in parts; the browser joins them in order.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      throw new HttpError(405, 'Use GET.')
    }

    const slug = typeof req.query.asset === 'string' ? req.query.asset : ''
    if (!/^[a-z0-9-]{1,100}$/.test(slug)) throw new HttpError(404, 'Unknown asset.')

    const supabase = getSupabaseAdmin()
    const asset = await fetchAsset(supabase, slug)
    if (!asset) throw new HttpError(404, 'Unknown asset.')
    if (!asset.hasSource) throw new HttpError(404, 'This asset has no downloadable file yet.')

    if (asset.priceType === 'premium') {
      const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : ''
      if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
        throw new HttpError(402, 'This is a premium asset. Purchase it to download.')
      }
      let session
      try {
        session = await getStripe().checkout.sessions.retrieve(sessionId)
      } catch (error) {
        if (error?.type === 'StripeInvalidRequestError') throw new HttpError(403, 'Checkout session not found.')
        throw error
      }
      const bundle = BUNDLES[session.metadata?.bundleId]
      const covers = session.metadata?.assetId === asset.id || Boolean(bundle?.assetIds.includes(asset.id))
      if (session.payment_status !== 'paid' || !covers) {
        throw new HttpError(403, 'This checkout does not include this asset.')
      }
    }

    // Content-Disposition: attachment, so even a plain link to the file downloads
    // it rather than opening it (images and SVGs would otherwise display).
    const filename = asset.sourceFilename || asset.sourcePaths[0].split('/').pop()
    const { data, error } = await supabase.storage
      .from(SOURCE_BUCKET)
      .createSignedUrls(asset.sourcePaths, LINK_LIFETIME_SECONDS, {
        download: asset.sourcePaths.length === 1 ? filename : true,
      })
    if (error || !data || data.some((item) => item.error || !item.signedUrl)) {
      console.error('Signed URL error', error ?? data)
      throw new HttpError(502, 'Could not prepare the download. Please try again.')
    }

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({
      filename,
      urls: data.map((item) => item.signedUrl),
      expiresIn: LINK_LIFETIME_SECONDS,
    })
  } catch (error) {
    sendError(res, error)
  }
}
