import { useEffect, useState } from 'react'
import './LoadingScreen.css'

// One full look-around-and-blink cycle (see LoadingScreen.css). Visitors who
// prefer reduced motion get a short, still splash instead.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const MIN_VISIBLE_MS = reducedMotion ? 800 : 2800
const FADE_MS = 500

// The ArchiGrads cap as vector paths, traced from public/logo-mark.png
// (835 x 512): the board with its tassel, the body, and the body's two
// windows, which are the eyes.
const CAP_PATH = 'M415.3 16L423 16.6L444 22.2L448 22.5L449 23.5L465 28.3L491 34.5L804 118.5L811 121.7L816.5 128L817.3 135L815.6 141L814 143.3L810 146.3L804 148.5L753 163.5L727 172.5L724 172.7L722 174.5L713 175.7L558 224.5L539 229.6L513 238.5L432 263.5L431 264.5L419 267.5L414 267.3L403 264.5L337 243.5L335 244.6L334 242.6L328 240.6L324 241.5L322 238.8L216 205.5L215 206.5L213 204.7L197 199.7L182 195.5L180 196.6L178 195.5L177 193.7L168 190.8L164 190.5L161 188.6L105 171.5L103.5 173L103.5 175L103.5 271L112.8 278L117.1 285L119.5 293L118 301L118.5 302L114.6 308L109 313.5L104 316.3L97 318L93 318.1L85 316.2L79 312.7L74 307.7L70.5 300L70.5 288L72.7 282L75.6 278L84 272.1L84.4 271L84.4 166L80 163.6L27 147.5L23 145.6L17.6 140L15.5 132L17.9 126L22 121.8L31 117.5L47 113.5L48 112.5L56 111.5L169 80.6L305 45.1L312 42.5L360 30.5L372 26.5L401 19.2L404 17.5L405 18.2Z'
const BODY_PATH = 'M158.7 206L170 208.6L233 228.2L236 228.5L237 229.5L359 267.3L364 268.5L365 267.5L366 269.4L368 270.3L415 284.4L416 283.5L422 283.5L442 277.2L450 273.5L454 273.3L467 269.4L469 267.5L474 267.2L512 255.5L538 246.5L598 228.4L610 224.3L612 222.5L617 222.3L663 207.7L672 205.9L674.3 208L674.5 217L674.2 370L669 373.3L612 389.6L581 399.8L545 413.7L524 423.5L489 442.6L469 455.6L449 469.7L418 495.4L415 495.5L392 476L376 463.8L344 442.6L309 423.6L292 415.5L260 402.6L224 390.6L164 373.2L158.6 370L157.8 365L157.6 207Z'
const EYE_PATHS = [
  'M245 277.6L242.6 281L242.6 327L248 331.1L271 338.4L277 339.1L278.3 338L278.6 335L278.2 288L272 284.5L264 281.8L257 280.5L250 277.7Z',
  'M299 294.5L297.6 297L297.5 301L297.4 336L298.4 345L305 349.2L324 355.2L331 356.4L332.5 353L332 305L329 302.6L312 296.6L307 295.5L306 296.5L304 296.5L303 294.5Z',
]

// Same surface as <body> (index.css): page colour plus the 40 px drafting grid,
// so the splash fades into a page of exactly the same colour.
const PAGE_SURFACE = {
  backgroundColor: 'var(--page)',
  backgroundImage:
    'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
  backgroundPosition: '-1px -1px',
}

/**
 * Splash shown on the first load of the site: nothing but the ArchiGrads cap,
 * centred, as one inline SVG in the site's ink colour, with its two windows
 * turned into eyes that look around and blink. Stays at least one full cycle
 * (even if the page is ready sooner) and until the page has finished loading,
 * then fades out to reveal the site.
 */
export default function LoadingScreen() {
  const [phase, setPhase] = useState('visible') // 'visible' | 'fading' | 'gone'

  useEffect(() => {
    const pageLoaded = new Promise((resolve) => {
      if (document.readyState === 'complete') resolve()
      else window.addEventListener('load', resolve, { once: true })
    })
    const minimum = new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_MS))
    let fadeTimer
    let cancelled = false
    Promise.all([pageLoaded, minimum]).then(() => {
      if (cancelled) return
      setPhase('fading')
      fadeTimer = setTimeout(() => setPhase('gone'), FADE_MS)
    })
    return () => {
      cancelled = true
      clearTimeout(fadeTimer)
    }
  }, [])

  // Keep the page behind still while the splash is up.
  useEffect(() => {
    if (phase === 'gone') return undefined
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [phase])

  if (phase === 'gone') return null

  return (
    <div
      role="status"
      aria-label="Loading ArchiGrads"
      className={`fixed inset-0 z-[100] flex min-h-screen items-center justify-center transition-opacity ease-out ${
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ ...PAGE_SURFACE, transitionDuration: `${FADE_MS}ms` }}
    >
      {/* Light mode: the brand navy, #042c4f (the average colour of public/logo-mark.png);
          dark mode: off-white. The paths use fill="currentColor". */}
      <svg
        viewBox="0 0 835 512"
        aria-hidden
        className="w-44 text-[#042c4f] sm:w-52 dark:text-neutral-50"
      >
        <path d={CAP_PATH} fill="currentColor" />
        <path d={BODY_PATH} fill="currentColor" />
        {/* The eyes: the windows, in the page colour so they read as cut-outs. */}
        {EYE_PATHS.map((d) => (
          <g key={d} className="loader-eye">
            <path d={d} fill="var(--page)" />
          </g>
        ))}
      </svg>
    </div>
  )
}
