import { HttpError, sendError } from './_stripe.js'
import { getSupabaseAdmin } from './_supabase.js'

/**
 * POST /api/hide  { assetId, hidden = true }
 *
 * Hides (or un-hides) an asset for the admin "Hide" button. Proof-of-concept
 * trade-off: there is no authentication (the admin login is a front-end mock),
 * so anyone who calls this can toggle is_hidden. It can do nothing else: the
 * browser still has no write access to the database, and this function only
 * ever changes the is_hidden flag of one asset. Undo by setting it back.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      throw new HttpError(405, 'Use POST.')
    }

    const assetId = typeof req.body?.assetId === 'string' ? req.body.assetId : ''
    if (!/^[a-z0-9-]{1,100}$/.test(assetId)) throw new HttpError(404, 'Unknown asset.')
    const hidden = req.body?.hidden !== false

    const { data, error } = await getSupabaseAdmin()
      .from('assets')
      .update({ is_hidden: hidden })
      .eq('slug', assetId)
      .select('slug, is_hidden')
    if (error) throw new Error(error.message)
    if (!data.length) throw new HttpError(404, 'Unknown asset.')

    res.status(200).json({ assetId, hidden: data[0].is_hidden })
  } catch (error) {
    sendError(res, error)
  }
}
