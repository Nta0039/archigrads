import { SOURCE_BUCKET, THUMBNAIL_BUCKET } from '../src/lib/catalogue.js'
import { HttpError, sendError } from './_stripe.js'
import { getSupabaseAdmin } from './_supabase.js'

/**
 * POST /api/publish  { title, image: <base64 PNG>, styleLabel? }  ->  { slug, title }
 *
 * Publishes an AI Studio result to the public library: the PNG goes into both
 * the "thumbnails" and "source-files" buckets and a free "AI Generated" row is
 * added to public.assets.
 *
 * Done here with the service-role key rather than from the browser, so the
 * public key never gets write access to storage or the database. The upload is
 * checked to be a real PNG of reasonable size. Admins can remove anything
 * published with the Hide button.
 */
const MAX_BYTES = 3.5 * 1024 * 1024 // stays under Vercel's 4.5 MB request limit once base64-encoded
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readBody(body) {
  const title = typeof body?.title === 'string' ? body.title.trim().replace(/\s+/g, ' ') : ''
  if (title.length < 2) throw new HttpError(400, 'Please give the asset a title.')
  if (title.length > 80) throw new HttpError(400, 'Please keep the title under 80 characters.')

  const base64 = typeof body?.image === 'string' ? body.image.replace(/^data:image\/png;base64,/, '') : ''
  if (!base64 || base64.length > Math.ceil(MAX_BYTES / 3) * 4 + 4) {
    throw new HttpError(413, 'The image is missing or too large to publish.')
  }
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length < 100 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new HttpError(400, 'Only PNG images can be published.')
  }
  const subject = typeof body?.styleLabel === 'string' ? body.styleLabel.slice(0, 40) : null
  return { title, bytes, subject }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      throw new HttpError(405, 'Use POST.')
    }
    const { title, bytes, subject } = readBody(req.body)
    const supabase = getSupabaseAdmin()

    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'asset'
    const slug = `ai-${base}-${Date.now().toString(36)}`
    const path = `ai-generated/${slug}.png`

    for (const bucket of [THUMBNAIL_BUCKET, SOURCE_BUCKET]) {
      const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: 'image/png', upsert: false })
      if (error) {
        await supabase.storage.from(THUMBNAIL_BUCKET).remove([path]) // undo a half-finished upload
        throw new Error(`Upload to ${bucket} failed: ${error.message}`)
      }
    }

    const { data: last } = await supabase.from('assets').select('sort_order').order('sort_order', { ascending: false }).limit(1)
    const { error: insertError } = await supabase.from('assets').insert({
      slug,
      title,
      category: 'AI Generated', // free community category, separate from the official assets
      subject: subject ? `AI · ${subject}` : 'AI generated',
      formats: ['.png'],
      thumbnail_path: path,
      source_paths: [path],
      source_filename: `${title}.png`,
      is_published: true,
      is_hidden: false,
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
    })
    if (insertError) {
      await Promise.all([THUMBNAIL_BUCKET, SOURCE_BUCKET].map((bucket) => supabase.storage.from(bucket).remove([path])))
      throw new Error(`Could not add the asset: ${insertError.message}`)
    }

    res.status(201).json({ slug, title })
  } catch (error) {
    sendError(res, error)
  }
}
