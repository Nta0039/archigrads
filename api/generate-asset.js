import Replicate from 'replicate'
import { HttpError, sendError } from './_stripe.js'

/**
 * AI Studio pipeline on Replicate: text -> image (FLUX schnell) -> background
 * removal (851-labs/background-remover) -> transparent PNG.
 *
 * Model start-up time on Replicate varies, so nothing here waits for a model to
 * finish (that could exceed Vercel's function time limit). Instead:
 *
 *   POST /api/generate-asset  { prompt, view, style }  -> { id, stage: 'image' }
 *   GET  /api/generate-asset?id=<prediction id>
 *        -> { id, stage: 'image' | 'background', status }   still working
 *        -> { id, stage: 'background' }   image done; background removal started
 *                                         (the client keeps polling the new id)
 *        -> { stage: 'done', url }        the transparent PNG
 *
 * Only predictions made by these two models are ever read or advanced, and the
 * background step always takes its image from step 1's output on the server.
 */
const IMAGE_MODEL = 'black-forest-labs/flux-schnell'
const CUTOUT_MODEL = '851-labs/background-remover'

const VIEW_HINTS = {
  'Top view': 'orthographic top-down plan view',
  Elevation: 'orthographic side elevation view',
  Isometric: 'isometric axonometric view',
}
const STYLE_HINTS = {
  Silhouette: 'solid dark grey silhouette, minimal detail',
  'Line drawing': 'clean black line drawing, technical architectural illustration',
  'Soft render': 'soft shaded 3D render in neutral greys',
}

function buildPrompt({ prompt, view, style }) {
  return [
    prompt,
    VIEW_HINTS[view] ?? '',
    STYLE_HINTS[style] ?? '',
    // Hidden prompt engineering: one isolated object on white so the
    // background remover gets a clean cut-out.
    'single isolated object, centered, isolated on a pure white background',
    'architectural graphic style, flat lighting, crisp edges, no text, no watermark, no ground shadow',
  ]
    .filter(Boolean)
    .join(', ')
}

function getReplicate() {
  const auth = process.env.REPLICATE_API_TOKEN
  if (!auth) throw new HttpError(503, 'AI generation is not configured (missing REPLICATE_API_TOKEN).')
  return new Replicate({ auth })
}

/** Turns Replicate API failures into messages the page can show. */
function toHttpError(error) {
  const status = error?.response?.status
  // Replicate's own explanation (e.g. billing or permission detail) for the logs.
  if (status) console.error(`[replicate] HTTP ${status}: ${String(error.message).slice(0, 500)}`)
  if (status === 402) {
    return new HttpError(402, 'The AI credit for this site has run out. Please try again later.')
  }
  if (status === 401 || status === 403) return new HttpError(503, 'The AI service rejected our credentials.')
  if (status === 429) return new HttpError(429, 'The AI service is busy right now. Please wait a moment and try again.')
  if (status === 404) return new HttpError(404, 'That generation job no longer exists. Please start again.')
  return error
}

function failureMessage(prediction) {
  const raw = String(prediction.error ?? '')
  if (/nsfw|safety/i.test(raw)) return 'That prompt was blocked by the safety filter. Please try a different description.'
  return prediction.status === 'canceled' ? 'The generation was cancelled.' : 'The AI model could not finish this image. Please try again.'
}

async function startImage(replicate, body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  if (prompt.length < 3) throw new HttpError(400, 'Please describe the asset in a few words.')
  if (prompt.length > 300) throw new HttpError(400, 'Please keep the description under 300 characters.')

  const prediction = await replicate.predictions.create({
    model: IMAGE_MODEL,
    input: {
      prompt: buildPrompt({ prompt, view: body.view, style: body.style }),
      aspect_ratio: '1:1',
      num_outputs: 1,
      output_format: 'png',
      go_fast: true,
      megapixels: '1',
    },
  })
  return { id: prediction.id, stage: 'image', status: prediction.status }
}

async function advance(replicate, id) {
  if (!/^[a-z0-9]{8,64}$/i.test(id)) throw new HttpError(400, 'Invalid job id.')
  const prediction = await replicate.predictions.get(id)
  const stage = prediction.model === IMAGE_MODEL ? 'image' : prediction.model === CUTOUT_MODEL ? 'background' : null
  if (!stage) throw new HttpError(404, 'Unknown job.')

  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    console.error('Replicate prediction failed', id, prediction.model, prediction.error)
    throw new HttpError(502, failureMessage(prediction))
  }
  if (prediction.status !== 'succeeded') return { id, stage, status: prediction.status }

  if (stage === 'image') {
    const imageUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
    if (!imageUrl) throw new HttpError(502, 'The AI model returned no image. Please try again.')
    const cutout = await replicate.predictions.create({
      model: CUTOUT_MODEL,
      input: { image: imageUrl, format: 'png', background_type: 'rgba', threshold: 0, reverse: false },
    })
    return { id: cutout.id, stage: 'background', status: cutout.status }
  }

  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
  if (!url) throw new HttpError(502, 'Background removal returned no image. Please try again.')
  return { stage: 'done', url }
}

export default async function handler(req, res) {
  try {
    const replicate = getReplicate()
    let result
    if (req.method === 'POST') result = await startImage(replicate, req.body)
    else if (req.method === 'GET') result = await advance(replicate, String(req.query.id ?? ''))
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
