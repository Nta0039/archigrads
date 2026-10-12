import { bundleForListing } from '../src/lib/bundles.js'
import { SOURCE_BUCKET, fetchAsset } from '../src/lib/catalogue.js'
import { HttpError, sendError } from './_stripe.js'
import { getSupabaseAdmin } from './_supabase.js'

/**
 * GET /api/asset-meta?asset=<slug>  ->  { filename, parts, bytes }
 *
 * File details for the preview modal. The source files sit in the private
 * bucket, which the browser cannot list, so the size is read here with the
 * service-role key. Only metadata is returned, never a link to the file.
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

    // A bundle card has no file of its own: report all of its files together.
    const bundle = bundleForListing(slug)
    const members = bundle ? await Promise.all(bundle.assetIds.map((id) => fetchAsset(supabase, id))) : [asset]
    const paths = members.filter(Boolean).flatMap((member) => member.sourcePaths)

    // Several paths: one file stored in parts, or a bundle's files; the sizes add up.
    const sizes = await Promise.all(
      paths.map(async (path) => {
        const slash = path.lastIndexOf('/')
        const folder = slash === -1 ? '' : path.slice(0, slash)
        const name = path.slice(slash + 1)
        const { data, error } = await supabase.storage.from(SOURCE_BUCKET).list(folder, { search: name, limit: 100 })
        if (error) throw new Error(`Could not read file details: ${error.message}`)
        return data.find((file) => file.name === name)?.metadata?.size ?? null
      }),
    )
    const known = sizes.filter((size) => typeof size === 'number')

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600')
    res.status(200).json({
      filename: bundle ? `${bundle.assetIds.length} files` : asset.sourceFilename,
      parts: paths.length,
      bytes: known.length === sizes.length && known.length ? known.reduce((sum, size) => sum + size, 0) : null,
    })
  } catch (error) {
    sendError(res, error)
  }
}
