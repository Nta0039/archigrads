import { timingSafeEqual } from 'node:crypto'
import { HttpError, sendError } from './_stripe.js'
import { getSupabaseAdmin } from './_supabase.js'

/**
 * POST /api/hide  { assetId, hidden = true }   header: x-admin-passcode
 *
 * Hides (or un-hides) an asset. The site's admin login is a front-end mock that
 * anyone can click, so the real check happens here: the request must carry the
 * ADMIN_PASSCODE set in Vercel. The browser never gets write access to the
 * database; this function uses the service-role key.
 */
function passcodeMatches(given, expected) {
  const a = Buffer.from(String(given ?? ''))
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      throw new HttpError(405, 'Use POST.')
    }

    const expected = process.env.ADMIN_PASSCODE
    if (!expected) {
      throw new HttpError(503, 'Hiding is not set up yet: add an ADMIN_PASSCODE environment variable in Vercel.')
    }
    if (!passcodeMatches(req.headers['x-admin-passcode'], expected)) {
      throw new HttpError(401, 'Wrong admin passcode.')
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
