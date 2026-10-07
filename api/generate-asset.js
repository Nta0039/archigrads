import { ApiError, createFalClient } from '@fal-ai/client'
import { HttpError, sendError } from './_stripe.js'

/**
 * AI Studio pipeline on Fal.ai: text -> image -> background removal -> PNG.
 *
 *   1. fal-ai/recraft/v3/text-to-image  design-grade image on plain white.
 *      Recraft V3 on Fal has no transparent-background option, so:
 *   2. fal-ai/birefnet/v2 ("General Use (Heavy)", 2048 px, refined foreground)
 *      cuts the object out with very clean edges (fine branches, railings).
 *   Line drawings use Recraft's vector line-art style and come back as SVG;
 *   they skip step 2 and the browser removes the SVG's background shape.
 *
 * Both run on Fal's queue and nothing here waits for a model to finish (that
 * could exceed Vercel's function time limit). Instead:
 *
 *   POST /api/generate-asset  { prompt, angle, angleDetail, dimension, styleDetail }
 *                             -> { id, stage: 'image' }
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

/**
 * Camera angle (Rhino-style viewports). Top View has no direction; Elevation
 * and Isometric require one. Values must match the AI Studio controls.
 */
const ANGLES = {
  'Top View': { details: [], hint: () => 'strict top-down flat lay view, directly from above, orthographic' },
  Elevation: {
    details: ['Left', 'Right', 'Front', 'Back'],
    hint: (detail) =>
      `flat ${detail.toLowerCase()} elevation view, strict orthographic projection, no perspective, zero vanishing points`,
  },
  Isometric: {
    details: ['NW', 'NE', 'SE', 'SW'],
    hint: (detail) =>
      `true isometric projection, viewing from ${COMPASS[detail]} angle, 30-degree architectural isometric`,
  },
}
const COMPASS = { NW: 'the north-west', NE: 'the north-east', SE: 'the south-east', SW: 'the south-west' }

/**
 * Render style: dimension + detail -> Recraft settings and hidden prompt.
 * Raster results go through the BiRefNet cut-out; the 2D line drawing uses
 * Recraft's vector line-art style (clean Make2D lines) and comes back as SVG,
 * which the browser cuts out itself.
 */
const RENDER_STYLES = {
  '3D': {
    Textured: {
      recraft: { style: 'realistic_image' },
      hint: 'highly detailed 3D render, realistic materials and textures, professional lighting, raytraced',
    },
    'White Model': {
      recraft: { style: 'realistic_image' },
      hint: 'pure white architectural clay model, ambient occlusion, untextured, solid white monochrome plaster, soft studio lighting',
      // A white model on a white backdrop is the hardest case for any cut-out.
      backdrop: 'plain light grey studio background',
    },
  },
  '2D': {
    'Line Drawing': {
      // White + black palette: clean outlines and flat white surfaces (a
      // black-only palette fills surfaces black).
      recraft: { style: LINE_STYLE, colors: [{ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }] },
      hint: 'pure minimalist black and white line drawing, clean continuous lines, architectural CAD style, Rhino Make2D, zero texture, no shading, no gradients',
    },
    Textured: {
      recraft: { style: 'digital_illustration' },
      hint: 'flat 2D graphic illustration, architectural diagram style, textured, no 3D depth, orthographic flat vector style',
    },
  },
}

// Framing shared by every combination ("transparent background" enforcers:
// image models cannot draw transparency, so they get one isolated object on
// a plain backdrop and the cut-out step removes it).
const framing = (backdrop) =>
  `single isolated solid opaque object, centered and filling most of the frame, on a ${backdrop}, ` +
  'no ground shadow, no reflection, no scenery, no text, no watermark, no border'

/** Validates the four selections; throws a 400 for any combination the UI cannot produce. */
function readSelection(body) {
  const angle = ANGLES[body?.angle]
  if (!angle) throw new HttpError(400, 'Please choose a camera angle.')
  const angleDetail = angle.details.length ? body.angleDetail : null
  if (angle.details.length && !angle.details.includes(angleDetail)) {
    throw new HttpError(400, `Please choose a direction for the ${body.angle.toLowerCase()} view.`)
  }
  const render = RENDER_STYLES[body?.dimension]?.[body?.styleDetail]
  if (!render) throw new HttpError(400, 'Please choose a render style.')
  return { angle, angleDetail, render }
}

// Image models weight the start of a prompt most, so the view leads
// ("Front orthographic elevation of <subject>"), followed by the full modifiers.
const VIEW_LEADS = {
  'Top View': () => 'Top-down orthographic plan view of',
  Elevation: (detail) => `${detail} orthographic elevation (flat, straight-on, no perspective) of`,
  Isometric: (detail) => `Isometric view from the ${COMPASS[detail].replace('the ', '')} of`,
}

function buildPrompt(prompt, { angle, angleDetail, render }, angleName) {
  const lead = `${VIEW_LEADS[angleName](angleDetail)} ${prompt.replace(/^(a|an|the)\s+/i, (article) => article.toLowerCase())}`
  return [lead, angle.hint(angleDetail), render.hint, framing(render.backdrop ?? 'plain pure white background')].join(
    ', ',
  )
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
  const selection = readSelection(body)

  const { request_id } = await fal.queue.submit(ENDPOINTS.image, {
    input: {
      prompt: buildPrompt(prompt, selection, body.angle),
      image_size: 'square_hd',
      ...selection.render.recraft,
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
    // Vector styles return SVG, which the background remover cannot read. The
    // browser cuts SVG line art out itself (see AIGeneratorPage.jsx).
    if (/svg/i.test(image.content_type ?? '') || /\.svg(\?|$)/i.test(imageUrl)) {
      return { stage: 'done', url: imageUrl, format: 'svg' }
    }
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
