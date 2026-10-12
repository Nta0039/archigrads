import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const ARROW =
  'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border-2 border-neutral-950 bg-white text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white dark:border-white dark:bg-neutral-950 dark:text-white dark:hover:bg-white dark:hover:text-neutral-950'

/**
 * Preview images for the modal's left pane. One image: shown as is. Several (a
 * bundle's models): square arrow buttons on the edges, square dots below, the
 * keyboard's left/right arrows and touch swipes all move between them.
 */
export default function ModalGallery({ images, title }) {
  const [index, setIndex] = useState(0)
  const touchStart = useRef(null)
  const count = images.length
  const many = count > 1
  const go = (step) => setIndex((current) => (current + step + count) % count)

  useEffect(() => {
    if (!many) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  // Preload the neighbours so moving through the set is instant.
  useEffect(() => {
    if (!many) return
    for (const step of [1, -1]) new Image().src = images[(index + step + count) % count].src
  }, [index, images, count, many])

  if (!count) return <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">No preview</span>

  const current = images[index]
  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      onTouchStart={(event) => (touchStart.current = event.touches[0].clientX)}
      onTouchEnd={(event) => {
        if (!many || touchStart.current == null) return
        const dx = event.changedTouches[0].clientX - touchStart.current
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        touchStart.current = null
      }}
    >
      <img
        key={current.src}
        src={current.src}
        alt={many ? `${title}: ${current.caption} (${index + 1} of ${count})` : title}
        draggable={false}
        className="fade-in max-h-full max-w-full object-contain md:max-h-[calc(85vh-4.5rem)]"
      />

      {many && (
        <>
          <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={`${ARROW} left-0`}>
            <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next image" className={`${ARROW} right-0`}>
            <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>

          <div className="absolute inset-x-0 -bottom-2 flex flex-col items-center gap-2">
            <p className="bg-neutral-950/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white">
              {index + 1} / {count} · {current.caption}
            </p>
            <div role="tablist" aria-label="Preview images" className="flex gap-2">
              {images.map((image, i) => (
                <button
                  key={image.src}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show image ${i + 1}: ${image.caption}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 w-2 outline-offset-2 transition-colors ${
                    i === index ? 'bg-neutral-950 dark:bg-white' : 'bg-neutral-400 hover:bg-neutral-600 dark:bg-neutral-600 dark:hover:bg-neutral-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
