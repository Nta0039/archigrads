import { ApiError, createFalClient } from '@fal-ai/client'
import { HttpError, sendError } from './_stripe.js'

/**
 * AI Studio pipeline on Fal.ai: text -> image -> background removal -> PNG.
 *
 *   1. fal-ai/recraft/v3/text-to-image  design-grade image on plain white.
 *      Recraft V3 on Fal has no transparent-background option, so:
 *   2. fal-ai/birefnet/v2 ("General Use (Heavy)", 2048 px, refined foreground)
 *      cuts the object out with very clean edges (fine branches, railings).
 *
 * Both run on Fal's queue and nothing here waits for a model to finish (that
 * could exceed Vercel's function time limit). Instead:
 *
 *   POST /api/generate-asset  { prompt, view, style }  -> { id, stage: 'image' }
 *   GET  /api/generate-asset?id=<job id>
 *        -> { id, stage: 'image' | 'background', status }   still working
 *        -> { id, stage: 'background' }   image done; cut-out started
 *                                         (the client keeps polling the new id)
 *        -> { stage: 'done', url }        the transparent PNG
 *
 * Job ids are "<stage>_<fal request id>", so only these two endpoints are ever
 * queried, and step 2 always takes its image from step 1's result here.
 */
const ENDPOINTS = {
  image: 'fal-ai/recraft/v3/text-to-image',
  background: 'fal-ai/birefnet/v2',
}

// Recraft style used for "Line Drawing (Make2D)".
const LINE_STYLE = 'vector_illustration/line_art'

const VIEW_HINTS = {
  'Top view': 'orthographic top-down plan view',
  Elevation: 'orthographic side elevation view',
  Isometric: 'isometric axonometric view',
}
// Framing shared by every style: one object, filling the frame, on white (a
// plain white backdrop gives the cut-out model the cleanest edge to follow).
const FRAMING = 'single isolated object, centered and filling most of the frame, on a plain pure white background'

// UI style -> Recraft settings + hidden prompt suffix.
const STYLES = {
  'Realistic 3D': {
    recraft: { style: 'realistic_image' },
    suffix:
      ', solid opaque foreground object, highly detailed, professional lighting, ' +
      'isolated on a simple solid color background',
  },
  'Line Drawing (Make2D)': {
    // Recraft's line-art style plus a black-only palette: no textures or greys.
    recraft: { style: LINE_STYLE, colors: [{ r: 0, g: 0, b: 0 }] },
    suffix:
      ', pure minimalist black and white line drawing, clean continuous lines, architectural CAD style, ' +
      'Rhino Make2D, flat untextured white surfaces, absolute zero texture, no shading, no hatching, ' +
      'no gradients, no shadows.',
  },
}
const DEFAULT_STYLE = 'Realistic 3D'

function buildPrompt({ prompt, view, style }) {
  const { suffix } = STYLES[style] ?? STYLES[DEFAULT_STYLE]
  return `${[prompt, VIEW_HINTS[view], FRAMING].filter(Boolean).join(', ')}${suffix}`
}

function getFal() {
  const credentials = process.env.FAL_KEY
  if (!credentials) throw new HttpError(503, 'AI generation is not configured (missing FAL_KEY).')
  return createFalClient({ credentials })
}

/** Turns Fal API failures into messages the page can show. */
function toHttpError(error) {
  if (!(error instanceof ApiError)) return error
  const detail = JSON.stringify(error.body ?? '').slice(0, 400)
  console.error(`[fal] HTTP ${error.status}: ${error.message} ${detail}`)
  if (/balance|credit|billing|locked/i.test(detail + error.message)) {
    return new HttpError(402, 'The AI credit for this site has run out. Please try again later.')
  }
  if (error.status === 401 || error.status === 403) return new HttpError(503, 'The AI service rejected our credentials.')
  if (error.status === 429) return new HttpError(429, 'The AI service is busy right now. Please wait a moment and try again.')
  if (error.status === 404) return new HttpError(404, 'That generation job no longer exists. Please start again.')
  if (error.status === 422) {
    if (/nsfw|safety|content|policy/i.test(detail)) {
      return new HttpError(422, 'That prompt was blocked by the safety filter. Please try a different description.')
    }
    return new HttpError(422, 'The AI model could not use that description. Please rephrase it and try again.')
  }
  return new HttpError(502, 'The AI service could not finish this image. Please try again.')
}

const jobId = (stage, requestId) => `${stage}_${requestId}`

function parseJobId(id) {
  const match = /^(image|background)_([A-Za-z0-9-]{8,80})$/.exec(id)
  if (!match) throw new HttpError(400, 'Invalid job id.')
  return { stage: match[1], requestId: match[2] }
}

async function startImage(fal, body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  if (prompt.length < 3) throw new HttpError(400, 'Please describe the asset in a few words.')
  if (prompt.length > 300) throw new HttpError(400, 'Please keep the description under 300 characters.')

  const { request_id } = await fal.queue.submit(ENDPOINTS.image, {
    input: {
      prompt: buildPrompt({ prompt, view: body.view, style: body.style }),
      image_size: 'square_hd',
      ...(STYLES[body.style] ?? STYLES[DEFAULT_STYLE]).recraft,
    },
  })
  return { id: jobId('image', request_id), stage: 'image', status: 'starting' }
}

async function advance(fal, id) {
  const { stage, requestId } = parseJobId(id)
  const endpoint = ENDPOINTS[stage]

  const { status } = await fal.queue.status(endpoint, { requestId })
  if (status !== 'COMPLETED') {
    return { id, stage, status: status === 'IN_QUEUE' ? 'starting' : 'processing' }
  }

  // COMPLETED can still be a failure; result() throws an ApiError in that case.
  const { data } = await fal.queue.result(endpoint, { requestId })

  if (stage === 'image') {
    const image = data?.images?.[0]
    const imageUrl = image?.url
    if (!imageUrl) throw new HttpError(502, 'The AI model returned no image. Please try again.')
    console.log(`[fal] image ready: ${image.content_type ?? 'unknown type'}`)
    const { request_id } = await fal.queue.submit(ENDPOINTS.background, {
      input: {
        image_url: imageUrl,
        model: 'General Use (Heavy)',
        operating_resolution: '2048x2048',
        refine_foreground: true,
        output_format: 'png',
      },
    })
    return { id: jobId('background', request_id), stage: 'background', status: 'starting' }
  }

  const url = data?.image?.url
  if (!url) throw new HttpError(502, 'Background removal returned no image. Please try again.')
  return { stage: 'done', url }
}

export default async function handler(req, res) {
  try {
    const fal = getFal()
    let result
    if (req.method === 'POST') result = await startImage(fal, req.body)
    else if (req.method === 'GET') result = await advance(fal, String(req.query.id ?? ''))
    else {
      res.setHeader('Allow', 'GET, POST')
      throw new HttpError(405, 'Use POST to start or GET to check a job.')
    }
    res.setHeader('Cache-Control', 'no-store')
    res.status(result.stage === 'done' ? 200 : 202).json(result)
  } catch (error) {
    sendError(res, toHttpError(error))
  }
}
