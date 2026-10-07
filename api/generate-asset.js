import { ApiError, createFalClient } from '@fal-ai/client'
import Replicate from 'replicate'
import { HttpError, sendError } from './_stripe.js'

/**
 * AI Studio: four transparent PNGs per prompt, on one of two engines.
 *
 *   Fal.ai (Premium)     fal-ai/flux/dev -> fal-ai/bria/background/remove
 *                        2D Line Drawing: Recraft V3 vector line art (clean
 *                        Make2D lines, returned as SVG and cut out in the
 *                        browser; Flux cannot draw clean CAD lines).
 *   Replicate (Standard) black-forest-labs/flux-schnell -> 851-labs/background-remover
 *
 * Nothing here waits for a model to finish (that could exceed Vercel's
 * function time limit). The four jobs are started in parallel and the page
 * polls each one:
 *
 *   POST /api/generate-asset  { prompt, engine, angle, angleDetail, dimension, styleDetail }
 *        -> { jobs: [{ id, stage: 'image', status }, x4] }
 *   GET  /api/generate-asset?id=<job id>
 *        -> { id, stage: 'image' | 'background', status }   still working
 *        -> { id, stage: 'background' }   image done; cut-out started (poll the new id)
 *        -> { stage: 'done', url, format? }                 transparent PNG (or SVG)
 *
 * Job ids are "<step>_<provider request id>". Only the steps below can ever be
 * queried, and every cut-out takes its image from the previous step here.
 */
const IMAGES_PER_PROMPT = 4

const STEPS = {
  'fal-flux': { provider: 'fal', stage: 'image', endpoint: 'fal-ai/flux/dev', next: 'fal-bria' },
  'fal-recraft': { provider: 'fal', stage: 'image', endpoint: 'fal-ai/recraft/v3/text-to-image', next: 'fal-bria' },
  'fal-bria': { provider: 'fal', stage: 'background', endpoint: 'fal-ai/bria/background/remove' },
  'rep-flux': { provider: 'replicate', stage: 'image', model: 'black-forest-labs/flux-schnell', next: 'rep-cutout' },
  'rep-cutout': { provider: 'replicate', stage: 'background', model: '851-labs/background-remover' },
}

/** Camera angle (Rhino-style viewports). Values must match the AI Studio controls. */
const COMPASS = { NW: 'the north-west', NE: 'the north-east', SE: 'the south-east', SW: 'the south-west' }
const ANGLES = {
  'Top View': {
    details: [],
    lead: () => 'Top-down orthographic plan view of',
    hint: () => 'strict top-down flat lay view, directly from above, orthographic',
  },
  Elevation: {
    details: ['Left', 'Right', 'Front', 'Back'],
    lead: (detail) => `${detail} orthographic elevation (flat, straight-on, no perspective) of`,
    hint: (detail) =>
      `flat ${detail.toLowerCase()} elevation view, strict orthographic projection, no perspective, zero vanishing points`,
  },
  Isometric: {
    details: ['NW', 'NE', 'SE', 'SW'],
    lead: (detail) => `Isometric view from ${COMPASS[detail]} of`,
    hint: (detail) => `true isometric projection, viewing from ${COMPASS[detail]} angle, 30-degree architectural isometric`,
  },
}

/** Render style: dimension + detail -> hidden prompt (and, for line art, Recraft). */
const RENDER_STYLES = {
  '3D': {
    Textured: { hint: 'highly detailed 3D render, realistic materials and textures, professional lighting, raytraced' },
    'White Model': {
      hint: 'pure white architectural clay model, ambient occlusion, untextured, solid white monochrome plaster, soft studio lighting',
      // A white model on a white backdrop is the hardest case for any cut-out.
      backdrop: 'plain light grey studio background',
    },
  },
  '2D': {
    'Line Drawing': {
      hint: 'pure minimalist black and white line drawing, clean continuous lines, architectural CAD style, Rhino Make2D, zero texture, no shading, no gradients',
      // Fal engine: Recraft vector line art with a white + black palette.
      recraft: {
        style: 'vector_illustration/line_art',
        colors: [{ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }],
      },
    },
    Textured: {
      hint: 'flat 2D graphic illustration, architectural diagram style, textured, no 3D depth, orthographic flat vector style',
    },
  },
}

// "Transparent background" enforcers: image models cannot draw transparency,
// so they get one isolated object on a plain backdrop that the cut-out removes.
const framing = (backdrop) =>
  `single isolated solid opaque object, centered and filling most of the frame, on a ${backdrop}, ` +
  'no ground shadow, no reflection, no scenery, no text, no watermark, no border'

/** Validates prompt, engine and the four selections (400 for anything the UI cannot produce). */
function readRequest(body) {
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  if (prompt.length < 3) throw new HttpError(400, 'Please describe the asset in a few words.')
  if (prompt.length > 300) throw new HttpError(400, 'Please keep the description under 300 characters.')
  const engine = body?.engine === 'replicate' ? 'replicate' : body?.engine === 'fal' ? 'fal' : null
  if (!engine) throw new HttpError(400, 'Please choose an AI engine.')

  const angle = ANGLES[body?.angle]
  if (!angle) throw new HttpError(400, 'Please choose a camera angle.')
  const angleDetail = angle.details.length ? body.angleDetail : null
  if (angle.details.length && !angle.details.includes(angleDetail)) {
    throw new HttpError(400, `Please choose a direction for the ${body.angle.toLowerCase()} view.`)
  }
  const render = RENDER_STYLES[body?.dimension]?.[body?.styleDetail]
  if (!render) throw new HttpError(400, 'Please choose a render style.')

  // Image models weight the start of a prompt most, so the view leads.
  const subject = prompt.replace(/^(a|an|the)\s+/i, (article) => article.toLowerCase())
  const fullPrompt = [
    `${angle.lead(angleDetail)} ${subject}`,
    angle.hint(angleDetail),
    render.hint,
    framing(render.backdrop ?? 'plain pure white background'),
  ].join(', ')
  return { engine, render, fullPrompt }
}

// --- providers ----------------------------------------------------------------

function getFal() {
  const credentials = process.env.FAL_KEY
  if (!credentials) throw new HttpError(503, 'The Fal.ai engine is not configured (missing FAL_KEY).')
  return createFalClient({ credentials })
}

function getReplicate() {
  const auth = process.env.REPLICATE_API_TOKEN
  if (!auth) throw new HttpError(503, 'The Replicate engine is not configured (missing REPLICATE_API_TOKEN).')
  return new Replicate({ auth })
}

// Community Replicate models must be started by version id ("owner/name" alone
// only works for official models). Looked up once per function instance.
const versionCache = new Map()
async function replicateVersion(replicate, model) {
  if (!versionCache.has(model)) {
    const [owner, name] = model.split('/')
    const id = (await replicate.models.get(owner, name))?.latest_version?.id
    if (!id) throw new HttpError(502, 'The background removal model is unavailable right now.')
    versionCache.set(model, id)
  }
  return versionCache.get(model)
}

/** Starts one step; returns the provider's request id. */
async function startStep(stepName, input) {
  const step = STEPS[stepName]
  if (step.provider === 'fal') {
    const { request_id } = await getFal().queue.submit(step.endpoint, { input })
    return request_id
  }
  const replicate = getReplicate()
  const prediction =
    stepName === 'rep-cutout'
      ? await replicate.predictions.create({ version: await replicateVersion(replicate, step.model), input })
      : await replicate.predictions.create({ model: step.model, input })
  return prediction.id
}

/** Reads one step: { done: false, status } or { done: true, url, contentType }. */
async function readStep(stepName, requestId) {
  const step = STEPS[stepName]
  if (step.provider === 'fal') {
    const fal = getFal()
    const { status } = await fal.queue.status(step.endpoint, { requestId })
    if (status !== 'COMPLETED') return { done: false, status: status === 'IN_QUEUE' ? 'starting' : 'processing' }
    // COMPLETED can still be a failure; result() throws an ApiError then.
    const { data } = await fal.queue.result(step.endpoint, { requestId })
    const file = step.stage === 'image' ? data?.images?.[0] : data?.image
    return { done: true, url: file?.url, contentType: file?.content_type ?? '' }
  }

  const prediction = await getReplicate().predictions.get(requestId)
  if (prediction.model !== step.model) throw new HttpError(404, 'Unknown job.')
  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    console.error('[replicate] prediction failed', requestId, prediction.error)
    if (/nsfw|safety/i.test(String(prediction.error))) {
      throw new HttpError(422, 'That prompt was blocked by the safety filter. Please try a different description.')
    }
    throw new HttpError(502, 'The AI model could not finish this image. Please try again.')
  }
  if (prediction.status !== 'succeeded') return { done: false, status: prediction.status }
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
  return { done: true, url, contentType: '' }
}

function cutoutInput(stepName, imageUrl) {
  if (stepName === 'fal-bria') return { image_url: imageUrl }
  return { image: imageUrl, format: 'png', background_type: 'rgba', threshold: 0, reverse: false }
}

/** Provider failures -> messages the page can show. */
function toHttpError(error) {
  const status = error instanceof ApiError ? error.status : error?.response?.status
  if (!status || error instanceof HttpError) return error
  const detail = error instanceof ApiError ? JSON.stringify(error.body ?? '') : String(error.message)
  console.error(`[ai] HTTP ${status}: ${String(error.message).slice(0, 200)} ${detail.slice(0, 300)}`)
  if (status === 402 || /balance|insufficient credit|billing|locked/i.test(detail)) {
    return new HttpError(402, 'The AI credit for this engine has run out. Try the other engine, or try again later.')
  }
  if (status === 401 || status === 403) return new HttpError(503, 'The AI service rejected our credentials.')
  if (status === 429) return new HttpError(429, 'The AI service is busy right now. Please wait a moment and try again.')
  if (status === 404) return new HttpError(404, 'That generation job no longer exists. Please start again.')
  if (status === 422) {
    if (/nsfw|safety|content|policy/i.test(detail)) {
      return new HttpError(422, 'That prompt was blocked by the safety filter. Please try a different description.')
    }
    return new HttpError(422, 'The AI model could not use that description. Please rephrase it and try again.')
  }
  return new HttpError(502, 'The AI service could not finish this image. Please try again.')
}

// --- handlers -------------------------------------------------------------------

async function startJobs(body) {
  const { engine, render, fullPrompt } = readRequest(body)
  let stepName
  let input
  if (engine === 'fal' && render.recraft) {
    stepName = 'fal-recraft'
    input = { prompt: fullPrompt, image_size: 'square_hd', ...render.recraft }
  } else if (engine === 'fal') {
    stepName = 'fal-flux'
    input = { prompt: fullPrompt, image_size: 'square_hd', num_inference_steps: 28, guidance_scale: 3.5, num_images: 1, output_format: 'png', enable_safety_checker: true }
  } else {
    stepName = 'rep-flux'
    input = { prompt: fullPrompt, aspect_ratio: '1:1', num_outputs: 1, output_format: 'png', go_fast: true, megapixels: '1' }
  }

  // Four independent jobs, started in parallel (each gets its own random seed).
  const requestIds = await Promise.all(Array.from({ length: IMAGES_PER_PROMPT }, () => startStep(stepName, input)))
  return { jobs: requestIds.map((requestId) => ({ id: `${stepName}_${requestId}`, stage: 'image', status: 'starting' })) }
}

async function advance(id) {
  const match = /^(fal-flux|fal-recraft|fal-bria|rep-flux|rep-cutout)_([A-Za-z0-9-]{8,80})$/.exec(id)
  if (!match) throw new HttpError(400, 'Invalid job id.')
  const [, stepName, requestId] = match
  const step = STEPS[stepName]

  const state = await readStep(stepName, requestId)
  if (!state.done) return { id, stage: step.stage, status: state.status }
  if (!state.url) throw new HttpError(502, 'The AI model returned no image. Please try again.')

  if (step.stage === 'background') return { stage: 'done', url: state.url }

  // Vector line art (SVG) cannot go through a raster cut-out; the browser
  // removes the SVG's background shape instead.
  if (/svg/i.test(state.contentType) || /\.svg(\?|$)/i.test(state.url)) {
    return { stage: 'done', url: state.url, format: 'svg' }
  }
  const nextId = await startStep(step.next, cutoutInput(step.next, state.url))
  return { id: `${step.next}_${nextId}`, stage: 'background', status: 'starting' }
}

export default async function handler(req, res) {
  try {
    let result
    if (req.method === 'POST') result = await startJobs(req.body)
    else if (req.method === 'GET') result = await advance(String(req.query.id ?? ''))
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
