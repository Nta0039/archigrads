import { useEffect, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, CircleAlert, Download, LoaderCircle, ShoppingBag, X } from 'lucide-react'
import { useCheckout } from '../lib/checkout'
import { downloadAsset } from '../lib/download'
import { FLOWING_BORDER } from '../lib/flowingBorder'
import { useSavedAssets } from '../lib/savedAssets'

/** Raw bytes -> "850 KB", "12.4 MB" or "1.20 GB"; null when the size is unknown. */
const formatBytes = (bytes) => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

// Faint drafting grid behind the preview image (same tokens as the page grid).
const DRAFTING_GRID = {
  backgroundImage:
    'linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
  backgroundPosition: '-1px -1px',
}

/**
 * Lightbox for one asset: the preview image large on the left, details and the
 * buy / download actions on the right. Closes on X, backdrop click or Escape.
 */
export default function AssetPreviewModal({ asset, onClose }) {
  const closeRef = useRef(null)
  const [meta, setMeta] = useState({ status: 'loading' })
  const [download, setDownload] = useState({ status: 'idle', message: '' })
  const checkout = useCheckout(asset)
  const { saved, toggle } = useSavedAssets()
  const isSaved = saved.has(asset.id)
  const premium = asset.priceType === 'premium'

  // Escape to close, focus the close button, keep the page behind from scrolling,
  // and hand focus back to whatever opened the modal.
  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      opener?.focus?.()
    }
  }, [onClose])

  // The real size of the downloadable file (all parts added up) comes from
  // /api/asset-meta: it is not a database column, and the bucket is private.
  useEffect(() => {
    if (!asset.hasSource) return setMeta({ status: 'none' })
    let cancelled = false
    fetch(`/api/asset-meta?asset=${encodeURIComponent(asset.id)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((data) => !cancelled && setMeta({ status: 'ready', ...data }))
      .catch(() => !cancelled && setMeta({ status: 'error' }))
    return () => {
      cancelled = true
    }
  }, [asset.id, asset.hasSource])

  const startDownload = async () => {
    setDownload({ status: 'loading', message: '' })
    try {
      await downloadAsset(asset.id)
      setDownload({ status: 'idle', message: '' })
    } catch (error) {
      setDownload({ status: 'error', message: error.message })
    }
  }

  // Unknown or unavailable sizes show a dash instead of breaking the panel.
  const size =
    meta.status === 'loading' ? '…' : meta.status === 'ready' ? (formatBytes(meta.bytes) ?? '—') : '—'
  const formats = (
    <span className="flex flex-wrap justify-end gap-1.5">
      {asset.formats.map((format) => (
        <span
          key={format}
          className="border border-neutral-300 px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-wider text-neutral-700 dark:border-neutral-700 dark:text-neutral-300"
        >
          {format.replace('.', '')}
        </span>
      ))}
    </span>
  )
  const details = [
    ['Category', asset.type],
    ['Format', formats],
    ['Size', size],
  ]

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-preview-title"
        className="flex max-h-[85vh] w-[90vw] max-w-5xl flex-col overflow-hidden border-2 border-neutral-200 bg-white shadow-2xl md:flex-row dark:border-neutral-800 dark:bg-neutral-950"
      >
        {/* Image: two thirds, contained (never cropped) on a drafting grid. */}
        <div
          className="relative flex h-[36vh] shrink-0 items-center justify-center bg-neutral-100 p-4 md:h-auto md:min-h-[60vh] md:w-2/3 dark:bg-neutral-900/50"
          style={DRAFTING_GRID}
        >
          {asset.imageUrl ? (
            <img
              src={asset.imageUrl}
              alt={asset.title}
              draggable={false}
              className="max-h-full max-w-full object-contain md:max-h-[calc(85vh-2rem)]"
            />
          ) : (
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">No preview</span>
          )}
        </div>

        {/* Details: one third, scrolls on its own if the text runs long. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-neutral-200 md:w-1/3 md:border-l md:border-t-0 dark:border-neutral-800">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5 dark:border-neutral-800">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-400 dark:text-neutral-500">
                {asset.type}
              </p>
              <h2 id="asset-preview-title" className="mt-2 text-xl font-semibold leading-tight tracking-tight">
                {asset.title}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="shrink-0 border border-neutral-300 p-1 text-neutral-500 transition-colors hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-200 dark:hover:text-neutral-100"
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          <dl className="mx-5 mt-5 border-t border-neutral-200 dark:border-neutral-800">
            {details.map(([label, value]) => (
              <div key={label} className="flex min-h-11 items-center justify-between gap-4 border-b border-neutral-200 py-2.5 text-sm dark:border-neutral-800">
                <dt className="shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
                  {label}
                </dt>
                <dd className="min-w-0 break-words text-right font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-auto space-y-2 p-5">
            {premium ? (
              <button
                type="button"
                onClick={checkout.start}
                disabled={checkout.status === 'loading'}
                className={`${FLOWING_BORDER} flex w-full items-center justify-center gap-2 px-4 py-3 text-sm disabled:cursor-wait`}
              >
                {checkout.status === 'loading' ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden />
                ) : (
                  <ShoppingBag className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                )}
                {checkout.status === 'loading' ? 'Opening checkout…' : `A$${asset.price.toFixed(2)} AUD · Buy now`}
              </button>
            ) : (
              asset.hasSource && (
                <button
                  type="button"
                  onClick={startDownload}
                  disabled={download.status === 'loading'}
                  className="flex w-full items-center justify-center gap-2 bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700 disabled:cursor-wait disabled:opacity-80 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                >
                  {download.status === 'loading' ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  )}
                  {download.status === 'loading' ? 'Preparing download…' : 'Download free'}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => toggle(asset.id)}
              aria-pressed={isSaved}
              className="flex w-full items-center justify-center gap-2 border border-neutral-300 px-4 py-2.5 text-sm font-medium transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100"
            >
              {isSaved ? (
                <BookmarkCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              ) : (
                <Bookmark className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              )}
              {isSaved ? 'Saved to Library' : 'Save to Library'}
            </button>
            {(checkout.status === 'error' || download.status === 'error') && (
              <p role="alert" className="flex items-start gap-1.5 pt-1 text-[11px] leading-snug text-neutral-600 dark:text-neutral-300">
                <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span>{checkout.status === 'error' ? checkout.message : download.message}</span>
              </p>
            )}
            {premium && (
              <p className="pt-1 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
                Secure payment with Stripe. Your download starts after purchase.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
