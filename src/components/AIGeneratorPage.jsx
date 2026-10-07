import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  CircleAlert,
  Cpu,
  Download,
  Layers,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { forceDownload } from '../lib/download'
import { invalidateCatalogue } from '../lib/useCatalogue'

/**
 * AI Studio: prompt -> /api/generate-asset -> transparent PNG variations
 * (2 x 2 grid on Fal, 2 on Replicate). The API starts the jobs in parallel and
 * the page polls them, so slow model start-ups never hit a request time limit.
 * Any result can be published to the public library via /api/publish.
 */
const ENGINES = [
  { value: 'fal', label: 'Fal.ai (Premium)', images: 4 },
  { value: 'replicate', label: 'Replicate (Standard)', images: 2 },
]
// Cascading viewport / render controls. Values are sent as-is to
// /api/generate-asset, which validates them and maps them to model settings.
const ANGLES = [
  { value: 'Top View', details: [] },
  { value: 'Elevation', details: ['Left', 'Right', 'Front', 'Back'] },
  { value: 'Isometric', details: ['NW', 'NE', 'SE', 'SW'] },
]
const DIMENSIONS = [
  { value: '3D', details: ['Textured', 'White Model'] },
  { value: '2D', details: ['Line Drawing', 'Textured'] },
]
const detailsOf = (options, value) => options.find((option) => option.value === value)?.details ?? []
const EXAMPLES = [
  'A modern minimalist lounge chair',
  'Deciduous street tree',
  'Person walking with a backpack',
  'Compact hatchback car',
]

const POLL_MS = 1500
const GIVE_UP_MS = 150_000

// What the loading screen says for each real pipeline stage.
const PHASES = {
  sending: { label: 'Sending your prompt…', progress: 8 },
  queued: { label: 'Waking up the AI model…', hint: 'The first run after a quiet spell can take a little longer.', progress: 18 },
  image: { label: 'Rendering your asset…', progress: 45 },
  background: { label: 'Removing the background…', progress: 80 },
  finishing: { label: 'Trimming the edges…', progress: 95 },
}

// Light chequerboard (in both themes, like Photoshop) to show transparency.
const CHECKERBOARD = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
  backgroundSize: '24px 24px',
  backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0',
}

function fileNameFor(prompt) {
  const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  return `archigrads-ai-${slug || 'asset'}.png`
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Crops the transparent margin around the generated object (plus a little
 * padding) so the PNG drops straight into a drawing. The result lives in the
 * browser as a blob, so Download keeps working after the AI provider's link expires.
 * Falls back to the original image if anything goes wrong.
 */
async function trimTransparent(url) {
  try {
    const blob = await (await fetch(url)).blob()
    return await trimImage(await createImageBitmap(blob))
  } catch (error) {
    console.warn('[ai-studio] Could not trim the image; using it as returned.', error)
    return { src: url, width: null, height: null, local: false }
  }
}

/** Light enough to be the drawing's paper/background (fill="rgb(254,254,254)" etc.). */
function isLightFill(fill) {
  const value = String(fill ?? '').trim().toLowerCase()
  if (value === 'white' || value === '#fff' || value === '#ffffff') return true
  const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/)
  if (rgb) return rgb.slice(1).every((channel) => Number(channel) >= 240)
  const hex = value.match(/^#([0-9a-f]{6})$/)
  return hex ? [0, 2, 4].every((i) => parseInt(hex[1].slice(i, i + 2), 16) >= 240) : false
}

/** A shape covering the whole canvas: Recraft's background (a full-size rect or path). */
function coversCanvas(element, width, height) {
  if (element.tagName.toLowerCase() === 'rect') {
    return (
      Number(element.getAttribute('x') ?? 0) <= 0 &&
      Number(element.getAttribute('y') ?? 0) <= 0 &&
      Number(element.getAttribute('width')) >= width &&
      Number(element.getAttribute('height')) >= height
    )
  }
  const d = element.getAttribute('d') ?? ''
  if (/[CQSTAHV]/i.test(d)) return false // only straight-line rectangles qualify
  const numbers = (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  const xs = numbers.filter((_, i) => i % 2 === 0)
  const ys = numbers.filter((_, i) => i % 2 === 1)
  return numbers.length >= 8 && Math.min(...xs) <= 0 && Math.min(...ys) <= 0 && Math.max(...xs) >= width && Math.max(...ys) >= height
}

/**
 * Rasterises an SVG (Fal line drawings) to a PNG for display and download, and
 * keeps the SVG itself (a true vector for Rhino / Illustrator). Line drawings
 * keep their white background (keepBackground); otherwise the full-canvas
 * background shape is deleted so only the object remains.
 */
async function prepareSvg(url, { keepBackground = false } = {}) {
  const text = await (await fetch(url)).text()
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.documentElement
  if (svg.tagName.toLowerCase() !== 'svg') throw new Error('not an SVG')
  const [, , viewWidth, viewHeight] = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  const width = viewWidth || Number(svg.getAttribute('width')) || 1024
  const height = viewHeight || Number(svg.getAttribute('height')) || 1024

  for (const shape of keepBackground ? [] : svg.querySelectorAll('path, rect')) {
    if (coversCanvas(shape, width, height) && isLightFill(shape.getAttribute('fill'))) shape.remove()
  }
  // Rasterise large for a crisp PNG.
  const rasterWidth = 2048
  const rasterHeight = Math.round((rasterWidth * height) / width)
  svg.setAttribute('width', String(rasterWidth))
  svg.setAttribute('height', String(rasterHeight))
  const svgBlob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
  const svgSrc = URL.createObjectURL(svgBlob)

  const image = new Image()
  image.src = svgSrc
  await image.decode()
  const png = await trimImage(image, rasterWidth, rasterHeight)
  return { ...png, svgSrc }
}

/** Crops the transparent margin of an image source and returns a local PNG blob URL. */
async function trimImage(source, sourceWidth, sourceHeight) {
  const width = sourceWidth ?? source.width
  const height = sourceHeight ?? source.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0, width, height)
  const alpha = ctx.getImageData(0, 0, width, height).data

  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error('empty image')

  const pad = Math.max(8, Math.round(Math.max(maxX - minX, maxY - minY) * 0.04))
  const x0 = Math.max(0, minX - pad)
  const y0 = Math.max(0, minY - pad)
  const w = Math.min(width, maxX + pad + 1) - x0
  const h = Math.min(height, maxY + pad + 1) - y0
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h)
  const trimmed = await new Promise((resolve) => out.toBlob(resolve, 'image/png'))
  if (!trimmed) throw new Error('could not encode PNG')
  return { src: URL.createObjectURL(trimmed), width: w, height: h, local: true }
}

/** One call to the API; every failure becomes an Error with a readable message. */
async function callApi(url, options) {
  let response
  try {
    response = await fetch(url, options)
  } catch (networkError) {
    throw new Error('Could not reach the server. Check your connection and try again.', { cause: networkError })
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (data?.error) throw new Error(data.error)
    if (response.status === 404) {
      throw new Error('The AI API is not available here. Use the live site or `vercel dev`; `npm run dev` has no /api.')
    }
    throw new Error(`The AI service returned an error (HTTP ${response.status}). Please try again.`)
  }
  return data
}

export default function AIGeneratorPage({ onBack }) {
  const [prompt, setPrompt] = useState('')
  const [engineLabel, setEngineLabel] = useState(ENGINES[0].label)
  const [angle, setAngle] = useState('Top View')
  const [angleDetail, setAngleDetail] = useState(null)
  const [dimension, setDimension] = useState('3D')
  const [styleDetail, setStyleDetail] = useState('Textured')
  const [status, setStatus] = useState('idle') // 'idle' | 'generating' | 'done' | 'error'
  const [startedAt, setStartedAt] = useState(0)
  const [run, setRun] = useState(null) // { prompt, angleLabel, styleLabel, engineLabel, fileBase }
  const [slots, setSlots] = useState([]) // one per image: { status, phase, image, error, publish }
  const [error, setError] = useState('')
  const runRef = useRef(0) // increments per run; an older run stops when it changes
  const inputRef = useRef(null)

  useEffect(() => () => {
    runRef.current += 1 // stop polling when leaving the page
  }, [])

  // A main option with sub-options needs one of them picked before generating.
  const needsAngleDetail = detailsOf(ANGLES, angle).length > 0 && !angleDetail
  const needsStyleDetail = !styleDetail
  const selectionComplete = !needsAngleDetail && !needsStyleDetail
  const angleLabel = angleDetail ? `${angle} · ${angleDetail}` : angle
  const styleLabel = `${dimension} ${styleDetail ?? ''}`.trim()
  const engine = ENGINES.find((option) => option.label === engineLabel) ?? ENGINES[0]
  const canGenerate = prompt.trim().length >= 3 && selectionComplete && status !== 'generating'

  const chooseAngle = (value) => {
    if (value === angle) return
    setAngle(value)
    setAngleDetail(null)
  }
  const chooseDimension = (value) => {
    if (value === dimension) return
    setDimension(value)
    setStyleDetail(null)
  }

  const updateSlot = (index, patch) =>
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)))

  const generate = async () => {
    if (!canGenerate) return
    const runId = ++runRef.current
    const isCurrent = () => runRef.current === runId
    const request = { prompt: prompt.trim(), angleLabel, styleLabel, engineLabel: engine.label }

    setStatus('generating')
    setStartedAt(Date.now())
    setError('')
    setRun({ ...request, fileBase: fileNameFor(request.prompt).replace(/\.png$/, '') })
    setSlots((previous) => {
      previous.forEach(releaseImage) // free blob URLs from the last run
      return Array.from({ length: engine.images }, () => ({ status: 'pending', phase: 'sending', publish: { state: 'idle' } }))
    })

    try {
      const { jobs } = await callApi('/api/generate-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: request.prompt, engine: engine.value, angle, angleDetail, dimension, styleDetail }),
      })
      if (!isCurrent()) return
      // The API may return fewer jobs than placeholders shown; drop the extras.
      setSlots((current) => current.slice(0, jobs.length))
      const active = jobs.map((job, index) => ({ index, job }))
      active.forEach(({ index, job }) => updateSlot(index, { phase: phaseOf(job) }))
      const deadline = Date.now() + GIVE_UP_MS

      // Poll every unfinished job in parallel until each one is done or failed.
      while (active.length && isCurrent()) {
        if (Date.now() > deadline) {
          active.forEach(({ index }) => updateSlot(index, { status: 'error', error: 'Took too long. Please try again.' }))
          break
        }
        await sleep(POLL_MS)
        if (!isCurrent()) return
        const outcomes = await Promise.all(
          active.map(async (entry) => {
            try {
              const job = await callApi(`/api/generate-asset?id=${encodeURIComponent(entry.job.id)}`)
              if (job.stage !== 'done') {
                entry.job = job
                updateSlot(entry.index, { phase: phaseOf(job) })
                return false
              }
              updateSlot(entry.index, { phase: 'finishing' })
              // Line drawings arrive with background 'white' and keep it (no
              // cut-out); other images are already transparent and only need trimming.
              const keepBackground = job.background === 'white'
              const image =
                job.format === 'svg' ? await prepareSvg(job.url, { keepBackground }) : await trimTransparent(job.url)
              if (isCurrent()) updateSlot(entry.index, { status: 'done', image })
              return true
            } catch (failure) {
              console.error('[ai-studio] Image', entry.index + 1, 'failed:', failure)
              if (isCurrent()) updateSlot(entry.index, { status: 'error', error: failure.message })
              return true
            }
          }),
        )
        for (let i = outcomes.length - 1; i >= 0; i--) if (outcomes[i]) active.splice(i, 1)
      }
      if (isCurrent()) setStatus('done')
    } catch (failure) {
      if (!isCurrent()) return
      console.error('[ai-studio] Generation failed:', failure)
      setError(failure.message)
      setStatus('error')
    }
  }

  const cancel = () => {
    runRef.current += 1
    setSlots((current) =>
      current.map((slot) => (slot.status === 'pending' ? { ...slot, status: 'error', error: 'Cancelled.' } : slot)),
    )
    setStatus('done')
  }

  // Publish one result to the public library via /api/publish.
  const publish = async (index) => {
    const slot = slots[index]
    if (!slot?.image || slot.publish.state === 'publishing' || slot.publish.state === 'published') return
    const title = window.prompt('Enter a title for this asset:', run?.prompt ?? '')?.trim()
    if (!title) return

    updateSlot(index, { publish: { state: 'publishing' } })
    try {
      const png = await pngForUpload(slot.image.src)
      await callApi('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, image: await blobToBase64(png), styleLabel: run?.styleLabel }),
      })
      invalidateCatalogue() // the library shows it on its next load
      updateSlot(index, { publish: { state: 'published', title } })
    } catch (failure) {
      console.error('[ai-studio] Publish failed:', failure)
      updateSlot(index, { publish: { state: 'error', message: failure.message } })
    }
  }

  const readyCount = slots.filter((slot) => slot.status === 'done').length
  const finishedCount = slots.filter((slot) => slot.status !== 'pending').length

  return (
    <main className="mx-auto max-w-5xl px-6 pb-24 pt-10 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Back to library
      </button>

      {/* Hero */}
      <header className="mt-10 text-center">
        <p className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-400 dark:text-neutral-500">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          AI Studio
        </p>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Can't find the right asset?
        </h1>
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-neutral-500 dark:text-neutral-400">
          Describe it and get up to four PNG variations (transparent, or on white for line drawings), ready for your sections, plans and elevations.
          Publish the best one to the community library.
        </p>
      </header>

      {/* Prompt */}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          generate()
        }}
        className="mx-auto mt-12 max-w-3xl rounded-lg border border-neutral-300 bg-white p-2 transition-colors focus-within:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus-within:border-neutral-100"
      >
        <label htmlFor="ai-prompt" className="sr-only">
          Describe the asset you need
        </label>
        <textarea
          ref={inputRef}
          id="ai-prompt"
          rows={3}
          value={prompt}
          maxLength={300}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              generate()
            }
          }}
          placeholder="A modern minimalist lounge chair"
          className="block w-full resize-none bg-transparent px-4 py-3 text-lg outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />
        <div className="grid gap-3 border-t border-neutral-200 px-2 pt-3 md:grid-cols-2 dark:border-neutral-800">
          <CascadeControl
            icon={Camera}
            label="Camera angle"
            options={ANGLES}
            value={angle}
            onChange={chooseAngle}
            detail={angleDetail}
            onDetailChange={setAngleDetail}
            detailLabel="Direction"
          />
          <CascadeControl
            icon={Layers}
            label="Render style"
            options={DIMENSIONS}
            value={dimension}
            onChange={chooseDimension}
            detail={styleDetail}
            onDetailChange={setStyleDetail}
            detailLabel="Finish"
          />
        </div>
        <div className="mt-3 grid gap-3 border-t border-neutral-200 px-2 pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end dark:border-neutral-800">
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
              <Cpu className="h-3 w-3" strokeWidth={2} aria-hidden />
              AI engine
            </p>
            <Segmented
              label="AI engine"
              options={ENGINES.map((option) => option.label)}
              value={engineLabel}
              onChange={setEngineLabel}
              stretch
            />
          </div>
          <button
            type="submit"
            disabled={!canGenerate}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {status === 'generating' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden />
            ) : (
              <Wand2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            )}
            {status === 'generating' ? 'Generating…' : `Generate ${engine.images}`}
          </button>
        </div>
        <p className="mt-2 px-2 text-xs text-neutral-500 dark:text-neutral-400" aria-live="polite">
          {selectionComplete ? (
            <>
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{angleLabel}</span>
              <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">/</span>
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{styleLabel}</span>
              <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">/</span>
              {engine.label}
            </>
          ) : needsAngleDetail ? (
            `Choose a direction for the ${angle.toLowerCase()} view to continue.`
          ) : (
            `Choose a ${dimension} finish to continue.`
          )}
        </p>
      </form>

      {status === 'idle' && (
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setPrompt(example)
                inputRef.current?.focus()
              }}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-100 dark:hover:text-neutral-100"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {status === 'error' && (
        <section className="mx-auto mt-10 max-w-3xl">
          <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800" style={CHECKERBOARD}>
            <ErrorState message={error} onRetry={generate} />
          </div>
        </section>
      )}

      {/* 2 x 2 results */}
      {(status === 'generating' || status === 'done') && run && (
        <section aria-live="polite" className="mx-auto mt-10 max-w-3xl">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
            <p className="min-w-0 truncate">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">{run.prompt}</span>
              <span className="mx-1.5 text-neutral-300 dark:text-neutral-600">·</span>
              {status === 'generating' ? (
                <ElapsedTime startedAt={startedAt} done={finishedCount} total={slots.length} />
              ) : (
                `${readyCount} of ${slots.length} ready`
              )}
            </p>
            {status === 'generating' && (
              <button
                type="button"
                onClick={cancel}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors hover:bg-neutral-200/60 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {slots.map((slot, index) => (
              <ResultCard
                key={index}
                slot={slot}
                index={index}
                run={run}
                onDownload={() => forceDownload([slot.image.src], `${run.fileBase}-${index + 1}.png`)}
                onDownloadSvg={() => forceDownload([slot.image.svgSrc], `${run.fileBase}-${index + 1}.svg`)}
                onPublish={() => publish(index)}
              />
            ))}
          </div>

          {status === 'done' && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                {run.engineLabel} · {run.angleLabel} · {run.styleLabel}. Images are trimmed to the object; download or
                publish to keep them.
              </p>
              <button
                type="button"
                onClick={generate}
                disabled={!canGenerate}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors hover:border-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:hover:border-neutral-100"
              >
                <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                Generate again
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

function phaseOf(job) {
  if (job.stage === 'image') return job.status === 'starting' ? 'queued' : 'image'
  return job.stage === 'background' ? 'background' : 'finishing'
}

function releaseImage(slot) {
  if (slot?.image?.local) URL.revokeObjectURL(slot.image.src)
  if (slot?.image?.svgSrc) URL.revokeObjectURL(slot.image.svgSrc)
}

function ElapsedTime({ startedAt, done, total }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000))
  return (
    <span className="tabular-nums">
      {done} of {total} finished · {seconds}s · usually 10–25 seconds
    </span>
  )
}

/** One cell of the 2 x 2 grid: skeleton while generating, then the image and its actions. */
function ResultCard({ slot, index, run, onDownload, onDownloadSvg, onPublish }) {
  const publishState = slot.publish?.state ?? 'idle'
  const published = publishState === 'published'

  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="relative aspect-square" style={CHECKERBOARD}>
        {slot.status === 'pending' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/70 px-4 text-center backdrop-blur-[2px] dark:bg-neutral-950/70">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-neutral-200 dark:bg-neutral-800">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10" />
            </div>
            <p key={slot.phase} className="fade-in text-xs font-medium text-neutral-700 dark:text-neutral-200">
              {(PHASES[slot.phase] ?? PHASES.sending).label}
            </p>
            <div className="h-1 w-24 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full rounded-full bg-neutral-900 transition-[width] duration-1000 ease-out dark:bg-neutral-100"
                style={{ width: `${(PHASES[slot.phase] ?? PHASES.sending).progress}%` }}
              />
            </div>
          </div>
        )}
        {slot.status === 'error' && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85 px-4 text-center dark:bg-neutral-950/85">
            <CircleAlert className="h-5 w-5 text-neutral-400" strokeWidth={1.5} aria-hidden />
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{slot.error}</p>
          </div>
        )}
        {slot.status === 'done' && (
          <img
            src={slot.image.src}
            alt={`Variation ${index + 1}: ${run.prompt}`}
            className="fade-in absolute inset-0 h-full w-full object-contain p-4"
          />
        )}
        <span className="absolute left-2 top-2 rounded bg-neutral-900/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
          {index + 1}
        </span>
      </div>

      {slot.status === 'done' && (
        <div className="fade-in flex flex-wrap items-center gap-2 border-t border-neutral-200 p-2.5 dark:border-neutral-800">
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-2 text-xs font-medium transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Download
          </button>
          {slot.image.svgSrc && (
            <button
              type="button"
              onClick={onDownloadSvg}
              title="Vector file for Rhino, Illustrator or AutoCAD"
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-2.5 py-2 text-xs font-medium transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100"
            >
              SVG
            </button>
          )}
          <button
            type="button"
            onClick={onPublish}
            disabled={published || publishState === 'publishing'}
            title={published ? `Published as “${slot.publish.title}”` : 'Add to the public asset library'}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors disabled:cursor-default ${
              published
                ? 'border border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'
                : 'bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-70 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300'
            }`}
          >
            {publishState === 'publishing' ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden />
            ) : published ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            ) : (
              <Upload className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            )}
            {publishState === 'publishing' ? 'Publishing…' : published ? 'Published' : 'Publish to Library'}
          </button>
          {publishState === 'error' && (
            <p role="alert" className="w-full text-[11px] leading-snug text-neutral-600 dark:text-neutral-300">
              {slot.publish.message}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

/** Re-encodes smaller if needed so the upload fits Vercel's request size limit. */
async function pngForUpload(src) {
  const blob = await (await fetch(src)).blob()
  const LIMIT = 3 * 1024 * 1024
  if (blob.type === 'image/png' && blob.size <= LIMIT) return blob
  let bitmap = await createImageBitmap(blob)
  let scale = Math.min(1, Math.sqrt(LIMIT / blob.size))
  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (png && png.size <= LIMIT) return png
    scale *= 0.75
  }
  throw new Error('This image is too large to publish.')
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Could not read the image.'))
    reader.readAsDataURL(blob)
  })
}

function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 px-6 text-center backdrop-blur-sm dark:bg-neutral-950/85">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
        <CircleAlert className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>
      <p className="mt-5 font-medium text-neutral-900 dark:text-neutral-100">We couldn't generate this asset</p>
      <p className="mt-2 max-w-sm text-sm text-neutral-600 dark:text-neutral-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:border-neutral-100"
      >
        <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Try again
      </button>
    </div>
  )
}

/**
 * Viewport-style control: main options as a segmented bar; when the chosen
 * option has sub-options they slide open in a nested panel underneath.
 */
function CascadeControl({ icon: Icon, label, options, value, onChange, detail, onDetailChange, detailLabel }) {
  const details = detailsOf(options, value)
  const open = details.length > 0

  return (
    <div role="group" aria-label={label} className="min-w-0">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
        <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
        {label}
      </p>
      <Segmented label={label} options={options.map((option) => option.value)} value={value} onChange={onChange} stretch />

      {/* grid-rows 0fr -> 1fr animates the panel's real height smoothly */}
      <div
        className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
          open ? 'mt-1.5 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
        }`}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div
            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
              open && !detail
                ? 'border-neutral-400 bg-neutral-50 dark:border-neutral-500 dark:bg-neutral-800/60'
                : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/40'
            }`}
          >
            <span className="shrink-0 pl-1 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500">
              {detailLabel}
            </span>
            <div role="group" aria-label={`${value} ${detailLabel.toLowerCase()}`} className="flex flex-1 flex-wrap justify-end gap-1">
              {details.map((option) => (
                <button
                  key={option}
                  type="button"
                  tabIndex={open ? 0 : -1}
                  onClick={() => onDetailChange(option)}
                  aria-pressed={detail === option}
                  className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    detail === option
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                      : 'text-neutral-500 hover:bg-white hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Segmented({ label, options, value, onChange, stretch = false }) {
  return (
    <div role="group" aria-label={label} className={`flex rounded-md border border-neutral-200 p-0.5 text-xs dark:border-neutral-700 ${stretch ? 'w-full' : ''}`}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`rounded px-2.5 py-1.5 font-medium transition-colors ${stretch ? 'flex-1' : ''} ${
            value === option
              ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
              : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
