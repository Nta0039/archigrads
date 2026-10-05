import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, LoaderCircle, RotateCcw, Sparkles, Wand2 } from 'lucide-react'

/**
 * AI Studio (front end only). Generation is mocked: after ~3 s the browser
 * draws a transparent PNG whose shape follows the prompt (chair, tree, person,
 * vehicle or a generic form), so "Download" gives a real .png file. Swap
 * generateMock() for a call to the AI API later; the UI stays the same.
 */
const STAGES = ['Analyzing prompt…', 'Composing silhouette…', 'Rendering pixels…', 'Removing background…']
const GENERATION_MS = 3000

const VIEWS = ['Top view', 'Elevation', 'Isometric']
const STYLES = ['Silhouette', 'Line drawing', 'Soft render']
const EXAMPLES = [
  'A modern minimalist chair in top view',
  'Deciduous tree in elevation',
  'Person walking with a backpack, side view',
  'Compact hatchback car from above',
]

// Light chequerboard (in both themes, like Photoshop) to show transparency.
const CHECKERBOARD = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)',
  backgroundSize: '24px 24px',
  backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0',
}

function subjectOf(prompt) {
  const p = prompt.toLowerCase()
  if (/(chair|sofa|table|desk|bench|bed|stool|furniture|armchair)/.test(p)) return 'furniture'
  if (/(tree|plant|shrub|bush|palm|vegetation|hedge|flower)/.test(p)) return 'tree'
  if (/(person|people|man|woman|child|figure|walking|sitting|human|student)/.test(p)) return 'person'
  if (/(car|bike|bicycle|bus|truck|van|vehicle|scooter|hatchback)/.test(p)) return 'vehicle'
  return 'generic'
}

/** Draws the mock result on a transparent 1024² canvas and returns a PNG data URL. */
function generateMock({ prompt, view, style }) {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.translate(size / 2, size / 2)

  const ink = '#262626'
  if (style === 'Line drawing') {
    ctx.strokeStyle = ink
    ctx.lineWidth = 14
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
  } else if (style === 'Soft render') {
    const gradient = ctx.createLinearGradient(-300, -300, 300, 300)
    gradient.addColorStop(0, '#737373')
    gradient.addColorStop(1, '#171717')
    ctx.fillStyle = gradient
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 18
  } else {
    ctx.fillStyle = ink
  }
  const paint = () => (style === 'Line drawing' ? ctx.stroke() : ctx.fill())
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    paint()
  }
  const circle = (x, y, r) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    paint()
  }

  const subject = subjectOf(prompt)
  if (view === 'Isometric') ctx.transform(1, 0.5, -1, 0.5, 0, 0) // simple axonometric skew

  if (subject === 'furniture') {
    roundRect(-180, -150, 360, 330, 40) // seat
    roundRect(-200, -250, 400, 90, 30) // backrest
    roundRect(-260, -150, 60, 300, 24) // arms
    roundRect(200, -150, 60, 300, 24)
  } else if (subject === 'tree') {
    if (view === 'Top view') {
      ;[[-90, -60, 190], [110, -40, 170], [0, 110, 200], [-150, 120, 120], [160, 140, 120]].forEach(([x, y, r]) => circle(x, y, r))
    } else {
      roundRect(-30, 80, 60, 330, 20) // trunk
      ;[[-120, -60, 170], [120, -40, 160], [0, -200, 190], [0, 40, 180]].forEach(([x, y, r]) => circle(x, y, r))
    }
  } else if (subject === 'person') {
    circle(0, -330, 70) // head
    roundRect(-95, -240, 190, 330, 60) // torso
    roundRect(-85, 70, 70, 330, 35) // legs
    roundRect(15, 70, 70, 330, 35)
  } else if (subject === 'vehicle') {
    roundRect(-200, -380, 400, 760, 120) // body
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out' // windows punched through
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.roundRect(-150, -230, 300, 150, 40)
    ctx.roundRect(-150, 120, 300, 120, 40)
    ctx.fill()
    ctx.restore()
  } else {
    roundRect(-260, -260, 520, 520, 60)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(0, 0, 170, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  return canvas.toDataURL('image/png')
}

function fileNameFor(prompt) {
  const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  return `archigrads-ai-${slug || 'asset'}.png`
}

export default function AIGeneratorPage({ onBack }) {
  const [prompt, setPrompt] = useState('')
  const [view, setView] = useState(VIEWS[0])
  const [style, setStyle] = useState(STYLES[0])
  const [status, setStatus] = useState('idle') // 'idle' | 'generating' | 'done'
  const [stage, setStage] = useState(0)
  const [result, setResult] = useState(null) // { src, fileName, prompt, view, style }
  const timers = useRef([])
  const inputRef = useRef(null)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const canGenerate = prompt.trim().length >= 3 && status !== 'generating'

  const generate = () => {
    if (!canGenerate) return
    const request = { prompt: prompt.trim(), view, style }
    timers.current.forEach(clearTimeout)
    setStatus('generating')
    setStage(0)
    setResult(null)
    timers.current = [
      ...STAGES.slice(1).map((_, index) =>
        setTimeout(() => setStage(index + 1), ((index + 1) * GENERATION_MS) / STAGES.length),
      ),
      setTimeout(() => {
        setResult({ ...request, src: generateMock(request), fileName: fileNameFor(request.prompt) })
        setStatus('done')
      }, GENERATION_MS),
    ]
  }

  const download = () => {
    const link = document.createElement('a')
    link.href = result.src
    link.download = result.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

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
          Describe it, and our AI will generate a transparent PNG for your project, ready to drop into
          your sections, plans and elevations.
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
          placeholder="A modern minimalist chair in top view"
          className="block w-full resize-none bg-transparent px-4 py-3 text-lg outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
        />
        <div className="flex flex-col gap-3 border-t border-neutral-200 px-2 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
          <div className="flex flex-wrap gap-2">
            <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
            <Segmented label="Style" options={STYLES} value={style} onChange={setStyle} />
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
            {status === 'generating' ? 'Generating…' : 'Generate'}
          </button>
        </div>
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

      {/* Generating / result */}
      {status !== 'idle' && (
        <section aria-live="polite" className="mx-auto mt-10 max-w-3xl">
          <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="relative aspect-square sm:aspect-[4/3]" style={CHECKERBOARD}>
              {status === 'generating' ? (
                <GeneratingState stage={stage} />
              ) : (
                <>
                  <img
                    src={result.src}
                    alt={`Generated asset: ${result.prompt}`}
                    className="fade-in absolute inset-0 h-full w-full object-contain p-8"
                  />
                  <span className="absolute left-3 top-3 rounded bg-neutral-900/85 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-white">
                    Mock preview
                  </span>
                </>
              )}
            </div>

            {status === 'done' && (
              <div className="fade-in flex flex-col gap-4 border-t border-neutral-200 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={result.prompt}>
                    {result.prompt}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {result.view} · {result.style} · Transparent PNG · 1024 × 1024
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={generate}
                    className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100"
                  >
                    <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={download}
                    className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                  >
                    <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    Download PNG
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  )
}

function GeneratingState({ stage }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-neutral-950/70">
      {/* Shimmering silhouette placeholder */}
      <div className="relative h-32 w-32 overflow-hidden rounded-2xl bg-neutral-200 dark:bg-neutral-800">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10" />
      </div>
      <p key={stage} className="fade-in mt-8 text-sm font-medium text-neutral-700 dark:text-neutral-200">
        {STAGES[stage]}
      </p>
      <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full rounded-full bg-neutral-900 transition-[width] duration-700 ease-out dark:bg-neutral-100"
          style={{ width: `${((stage + 1) / STAGES.length) * 100}%` }}
        />
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
        Step {stage + 1} of {STAGES.length}
      </p>
    </div>
  )
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md border border-neutral-200 p-0.5 text-xs dark:border-neutral-700">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={`rounded px-2.5 py-1.5 font-medium transition-colors ${
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
