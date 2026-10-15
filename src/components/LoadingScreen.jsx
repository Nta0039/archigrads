import { useEffect, useState } from 'react'
import './LoadingScreen.css'

// One full look-around-and-blink cycle (see LoadingScreen.css). Visitors who
// prefer reduced motion get a short, still splash instead.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const MIN_VISIBLE_MS = reducedMotion ? 800 : 2800
const FADE_MS = 500

// The logo's two window cut-outs, measured on public/logo-mark.png (835 x 512),
// as percentages of the image, so the eyes sit exactly on them at any size.
const EYES = [
  { left: 29.1, top: 54.3, width: 4.31, height: 12.11 },
  { left: 35.69, top: 57.42, width: 4.19, height: 12.31 },
]
// Body-coloured patch over the original cut-outs, with room for the eyes to
// look left and right (it lies entirely on the solid body of the cap).
const PATCH = { left: 27.4, top: 52.5, width: 14.2, height: 19.5 }
const pct = (box) => ({ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` })

/**
 * Splash shown on the first load of the site: the ArchiGrads cap with its two
 * windows turned into eyes that look around and blink. Stays at least one full
 * cycle (even if the page is ready sooner) and until the page has finished
 * loading, then fades out to reveal the site.
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
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-neutral-50 transition-opacity ease-out dark:bg-neutral-950 ${
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms`, '--loader-min': `${MIN_VISIBLE_MS}ms` }}
    >
      <div className="relative w-44 sm:w-52">
        <img
          src="/logo-mark.png"
          alt=""
          width={835}
          height={512}
          draggable={false}
          className="block h-auto w-full dark:brightness-0 dark:invert"
        />
        {/* Hide the original window cut-outs (cap body colour: navy by day, white by night)… */}
        <span aria-hidden className="absolute bg-[#022b4b] dark:bg-white" style={pct(PATCH)} />
        {/* …and draw them back as eyes, in the page colour so they read as the same holes. */}
        {EYES.map((eye, index) => (
          <span key={index} aria-hidden className="loader-eye absolute" style={pct(eye)}>
            <span className="block h-full w-full bg-neutral-50 dark:bg-neutral-950" style={{ borderRadius: '12%' }} />
          </span>
        ))}
      </div>

      <p className="mt-8 text-xl font-bold tracking-tight text-neutral-950 dark:text-white">ArchiGrads</p>
      <div aria-hidden className="mt-4 h-px w-40 bg-neutral-200 dark:bg-neutral-800">
        <div className="loader-progress h-full w-full bg-neutral-950 dark:bg-white" />
      </div>
      <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.3em] text-neutral-400 dark:text-neutral-500">
        Spend Less. Choose More. Design Better.
      </p>
    </div>
  )
}
