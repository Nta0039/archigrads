import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bookmark,
  Box,
  Boxes,
  Cuboid,
  CircleAlert,
  Crown,
  Download,
  EyeOff,
  Folder,
  Gift,
  Images,
  LayoutGrid,
  LoaderCircle,
  RotateCcw,
  Search,
  Sparkles,
  ShoppingBag,
  X,
} from 'lucide-react'
import { formatAud } from '../lib/catalogue'
import { FLOWING_BORDER } from '../lib/flowingBorder'
import { downloadAsset } from '../lib/download'
import { setLocallyHidden, useCatalogue } from '../lib/useCatalogue'
import { setAssetHidden } from '../lib/adminHide'
import { flashSale, isOnSale } from '../lib/pricing'
import { useSaleEpoch } from '../lib/useFlashSale'
import FlashSaleCountdown from './FlashSaleCountdown'
import { useSavedAssets } from '../lib/savedAssets'
import AssetPreviewModal from './AssetPreviewModal'

const TYPE_ICONS = {
  '2D Collections': Images,
  '3D Collections': Cuboid,
  'BIM Families': Boxes,
  'Detailed Models': Box,
  'AI Generated': Sparkles,
}

const AI_CATEGORY = 'AI Generated'
// Shown even while empty (new categories being filled before the presentation).
const PINNED_CATEGORIES = ['3D Collections']

/**
 * Category pills come from the categories table (only those with assets, see
 * stockedCategories); unknown new ones get a folder icon.
 * The community "AI Generated" category is promoted to sit right after "All".
 */
function buildCategoryOptions(categories, saved) {
  const ordered = [
    ...categories.filter(({ name }) => name === AI_CATEGORY),
    ...categories.filter(({ name }) => name !== AI_CATEGORY),
  ]
  return [
    { label: 'All', icon: LayoutGrid, matches: () => true },
    ...ordered.map(({ name }) => ({
      label: name,
      icon: TYPE_ICONS[name] ?? Folder,
      matches: (asset) => asset.type === name,
    })),
    // Bookmarks from the preview modal's "Save to Library" (this browser only).
    ...(saved.size ? [{ label: 'Saved', icon: Bookmark, matches: (asset) => saved.has(asset.id) }] : []),
  ]
}

/*
 * Highlight styles for the "AI Generated" pill, applied while it is not selected
 * (selected, it uses the normal solid pill). Swap ACTIVE_AI_EFFECT to try another.
 * Keyframes and colour tokens (--ai-*) live in src/index.css.
 *
 * Option A - Animated shimmer text: a silver gradient sweeps across the label.
 *   pill:  'border-neutral-300 dark:border-neutral-700'
 *   label: 'bg-[linear-gradient(110deg,#737373_35%,#e5e5e5_50%,#737373_65%)] bg-[length:200%_100%]
 *           bg-clip-text text-transparent animate-[ai-text-sweep_3.5s_linear_infinite] motion-reduce:animate-none'
 *
 * Option B - Flowing light border (in use): a 2px border with a silver-to-cyan
 *   beam sweeping around it (black base in light mode, graphite in dark mode),
 *   plus a soft drop shadow and a bold label.
 *   pill:  FLOWING_BORDER from src/lib/flowingBorder.js (shared with the AI Studio nav button)
 *
 * Option C - Soft glass glow: a gentle pulsing outer glow.
 *   pill:  'border-neutral-300 shadow-lg shadow-neutral-900/10 animate-pulse motion-reduce:animate-none
 *           dark:border-neutral-600 dark:shadow-white/20'
 */
const AI_PILL_EFFECTS = {
  shimmerText: {
    pill: 'border-neutral-300 text-neutral-600 hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100',
    label:
      'bg-[linear-gradient(110deg,#737373_35%,#e5e5e5_50%,#737373_65%)] bg-[length:200%_100%] bg-clip-text text-transparent animate-[ai-text-sweep_3.5s_linear_infinite] motion-reduce:animate-none',
  },
  flowingBorder: {
    pill: `${FLOWING_BORDER} px-[15px] py-[7px]`,
    ownsBox: true, // 2px border, so it sets its own padding (same overall size as the other pills)
    label: '',
  },
  softGlow: {
    pill: 'border-neutral-300 text-neutral-700 shadow-lg shadow-neutral-900/10 animate-pulse motion-reduce:animate-none dark:border-neutral-600 dark:text-neutral-200 dark:shadow-white/20',
    label: '',
  },
}
const ACTIVE_AI_EFFECT = AI_PILL_EFFECTS.flowingBorder

const PRICE_TYPES = [
  { value: 'free', label: 'Free', icon: Gift },
  { value: 'premium', label: 'Premium', icon: Crown },
]

// Format pills list whatever formats the library contains, in this order first.
const FORMAT_ORDER = ['.psd', '.ai', '.png', '.svg', '.dwg', '.pdf', '.rfa', '.rvt', '.3dm', '.skp']

// Format chips come from the formats the assets have; these are always offered
// as well, even before the library holds one (Rhino and SketchUp models).
const PINNED_FORMATS = ['.3dm', '.skp']

function collectFormats(assets) {
  const present = new Set([...assets.flatMap((asset) => asset.formats), ...PINNED_FORMATS])
  const rank = (format) => (FORMAT_ORDER.includes(format) ? FORMAT_ORDER.indexOf(format) : FORMAT_ORDER.length)
  return [...present].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

function matchesQuery(asset, query) {
  if (!query) return true
  const haystack = [asset.title, asset.type, asset.subject, asset.priceType, ...asset.formats].join(' ').toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}

/** The asset library: hero search, category / format filters and the grid. */
export default function AssetsLibraryPage({ isAdmin = false }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [format, setFormat] = useState(null)
  const [priceType, setPriceType] = useState(null) // 'free' | 'premium' | null
  const catalogue = useCatalogue()
  const [notice, setNotice] = useState(null) // { kind: 'hidden', asset } | { kind: 'error', message }
  const [selectedAsset, setSelectedAsset] = useState(null) // asset shown in the preview modal
  const { saved } = useSavedAssets()
  const closePreview = useCallback(() => setSelectedAsset(null), [])

  // Admin: remove the card at once, then persist is_hidden = true via /api/hide.
  // No prompt or confirmation; if the request fails the card comes back.
  const handleHideAsset = useCallback(async (asset) => {
    setLocallyHidden(asset.id, true)
    setNotice({ kind: 'hidden', asset })
    try {
      await setAssetHidden(asset.id, true)
    } catch (error) {
      setLocallyHidden(asset.id, false)
      console.error('[hide] Could not hide', asset.id, error)
      setNotice({ kind: 'error', message: error.message })
    }
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  const handleUndoHide = useCallback(async (asset) => {
    setNotice(null)
    try {
      await setAssetHidden(asset.id, false)
      setLocallyHidden(asset.id, false)
    } catch (error) {
      setNotice({ kind: 'error', message: error.message })
    }
  }, [])

  // Only categories that currently hold assets (or are pinned) get a pill or a
  // pricing tier, so no filter leads to an unexpected empty page.
  const stockedCategories = useMemo(
    () =>
      catalogue.categories.filter(
        ({ name }) => PINNED_CATEGORIES.includes(name) || catalogue.assets.some((asset) => asset.type === name),
      ),
    [catalogue.categories, catalogue.assets],
  )
  const categoryOptions = useMemo(() => buildCategoryOptions(stockedCategories, saved), [stockedCategories, saved])
  const formats = useMemo(() => collectFormats(catalogue.assets), [catalogue.assets])
  const activeCategory = categoryOptions.find((option) => option.label === category) ?? categoryOptions[0]

  // Assets on a flash sale are pinned to the top (A-Z); everything else keeps
  // its catalogue order. saleEpoch changes only when a sale starts or ends.
  const saleEpoch = useSaleEpoch()
  const visibleAssets = useMemo(() => {
    const matching = catalogue.assets.filter(
      (asset) =>
        (!priceType || asset.priceType === priceType) &&
        activeCategory.matches(asset) &&
        (!format || asset.formats.includes(format)) &&
        matchesQuery(asset, query.trim()),
    )
    const now = Date.now()
    const onSale = matching.filter((asset) => isOnSale(asset, now)).sort((a, b) => a.title.localeCompare(b.title))
    return onSale.length ? [...onSale, ...matching.filter((asset) => !onSale.includes(asset))] : matching
    // saleEpoch is a recompute trigger, not read directly.
  }, [catalogue.assets, query, priceType, activeCategory, format, saleEpoch])

  const hasFilters = query.trim() !== '' || priceType !== null || category !== 'All' || format !== null
  const clearFilters = () => {
    setQuery('')
    setCategory('All')
    setFormat(null)
    setPriceType(null)
  }

  return (
    <>
      {/* Hero & search: full-bleed photo (public/background1.png). The text sits
          in the sky; sizing lives in .hero-photo (index.css): the photo sits as in a 16:9
          bottom-pinned frame and the hero ends just above the pool, so the pavilion,
          terrace and mountains always sit below the search bar. Dark mode swaps in the
          night render of the same view (public/background1_night.jpg) with light text. */}
      <section className="hero-photo relative overflow-hidden border-b border-neutral-200 bg-white bg-[url('/background1.png')] dark:border-neutral-800 dark:bg-neutral-950 dark:bg-[url('/background1_night.jpg')]">
        {/* Soft wash over the sky only (white by day, deep blue-black by night), so
            the text stays crisp without dimming the building. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/70 via-white/35 to-transparent dark:from-neutral-950/55 dark:via-neutral-950/20"
        />
        <div className="relative mx-auto max-w-7xl px-6 pb-12 pt-10 text-center sm:pt-12 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-700 dark:text-neutral-300">
            Spend Less. Choose More. Design Better.
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-neutral-950 sm:text-6xl dark:text-white">
            ArchiGrads Library
          </h1>
          <p className="mx-auto mt-5 max-w-xl font-medium leading-relaxed text-neutral-800 dark:text-neutral-200">
            Free 2D cutouts, CAD blocks and Revit families, plus community assets made in AI Studio.
          </p>

          <form
            role="search"
            onSubmit={(event) => event.preventDefault()}
            className="mx-auto mt-10 flex max-w-3xl items-stretch overflow-hidden border-2 border-neutral-950 bg-white text-neutral-900 shadow-xl shadow-neutral-950/10 dark:border-white dark:bg-neutral-950/85 dark:text-neutral-100 dark:shadow-black/40"
          >
            <label htmlFor="asset-search" className="flex items-center pl-5 text-neutral-500 dark:text-neutral-400">
              <Search className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              <span className="sr-only">Search assets</span>
            </label>
            <input
              id="asset-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people, trees, furniture, textures…"
              className="min-w-0 flex-1 bg-transparent px-4 py-4 text-base outline-none placeholder:text-neutral-500 dark:placeholder:text-neutral-400 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="flex items-center px-3 text-neutral-500 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
              >
                <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
            )}
            <button
              type="submit"
              className="bg-neutral-950 px-6 text-sm font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-neutral-700 sm:px-8 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-300"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Filters */}
      {/* Sticky below the 64 px site header from md up (on phones the wrapped pills
          would cover half the screen). Translucent page colour + blur, like the header. */}
      <section className="relative z-30 border-b border-neutral-200 bg-neutral-100/90 backdrop-blur md:sticky md:top-16 dark:border-neutral-800 dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:px-8">
          <FilterRow label="Category">
            {/* Pricing works alongside the category, so "Premium" + "People" narrows both. */}
            {PRICE_TYPES.map(({ value, label, icon }) => (
              <Pill
                key={value}
                icon={icon}
                active={priceType === value}
                onClick={() => setPriceType(priceType === value ? null : value)}
              >
                {label}
              </Pill>
            ))}
            <span aria-hidden className="mx-1 hidden h-6 w-px self-center bg-neutral-300 sm:block dark:bg-neutral-700" />
            {/* "AI Generated" gets ACTIVE_AI_EFFECT; options A/B/C are listed above AI_PILL_EFFECTS. */}
            {categoryOptions.map(({ label, icon }) => (
              <Pill
                key={label}
                icon={icon}
                active={category === label}
                effect={label === AI_CATEGORY ? ACTIVE_AI_EFFECT : null}
                onClick={() => setCategory(label)}
              >
                {label}
              </Pill>
            ))}
          </FilterRow>
          <FilterRow label="Format">
            <Pill active={format === null} onClick={() => setFormat(null)}>
              Any
            </Pill>
            {formats.map((value) => (
              <Pill
                key={value}
                active={format === value}
                onClick={() => setFormat(format === value ? null : value)}
              >
                {value}
              </Pill>
            ))}
          </FilterRow>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8 lg:px-8">
        {priceType === 'premium' && (
          <PricingRules categories={stockedCategories} activeType={category} onSelectType={setCategory} />
        )}

        {catalogue.status === 'loading' && <GridSkeleton />}
        {catalogue.status === 'error' && <CatalogueError error={catalogue.error} onRetry={catalogue.retry} />}

        {catalogue.status === 'ready' && (
        <>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{visibleAssets.length}</span>{' '}
            {visibleAssets.length === 1 ? 'asset' : 'assets'}
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {visibleAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} isAdmin={isAdmin} onHide={handleHideAsset} onPreview={setSelectedAsset} />
          ))}
        </div>

        {visibleAssets.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No assets match these filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 border border-neutral-300 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100"
            >
              Clear filters
            </button>
          </div>
        )}
        </>
        )}
      </main>

      {notice && <AdminNotice notice={notice} onUndo={handleUndoHide} onDismiss={dismissNotice} />}
      {selectedAsset && <AssetPreviewModal key={selectedAsset.id} asset={selectedAsset} onClose={closePreview} />}
    </>
  )
}

function FilterRow({ label, children }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <span className="w-24 shrink-0 text-xs font-medium uppercase tracking-[0.25em] sm:pt-3 text-neutral-400 dark:text-neutral-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Pill({ active, onClick, icon: Icon, effect, children }) {
  const highlighted = effect && !active
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group/pill flex items-center gap-2 text-sm transition-[color,background-color,border-color,box-shadow] sm:text-base ${
        // An effect with ownsBox sets its own border width, padding and weight.
        highlighted && effect.ownsBox ? '' : 'border px-4 py-2 font-medium'
      } ${
        active
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
          : highlighted
            ? effect.pill
            : 'border-neutral-300 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-100 dark:hover:text-neutral-100'
      }`}
    >
      {Icon && (
        <Icon
          className={`h-4 w-4 shrink-0 transition-colors sm:h-[18px] sm:w-[18px] ${
            active
              ? ''
              : 'text-neutral-400 group-hover/pill:text-neutral-900 dark:text-neutral-500 dark:group-hover/pill:text-neutral-100'
          }`}
          strokeWidth={1.75}
          aria-hidden
        />
      )}
      {highlighted && effect.label ? <span className={effect.label}>{children}</span> : children}
    </button>
  )
}

/**
 * Premium pricing summary, shown only while the Premium filter is on. Built
 * from the categories table so it can never disagree with the price tags.
 * Each tier doubles as a shortcut to that category.
 */
function PricingRules({ categories, activeType, onSelectType }) {
  const tiers = categories.filter((tier) => tier.price).map((tier) => [tier.name, tier])
  const columns = ['', 'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4'][tiers.length] ?? 'lg:grid-cols-5'
  if (!tiers.length) return null // no paid category has assets (premium items are single purchases)

  return (
    <section
      aria-labelledby="pricing-rules-title"
      className="fade-in mb-8 border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-800/50"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="pricing-rules-title" className="flex items-center gap-2 text-sm font-semibold">
          <Crown className="h-4 w-4 text-neutral-500 dark:text-neutral-400" strokeWidth={1.75} aria-hidden />
          Premium pricing
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">All prices in Australian dollars (AUD)</p>
      </div>

      <ul className={`mt-4 grid grid-cols-1 gap-px overflow-hidden border border-neutral-200 bg-neutral-200 ${tiers.length > 1 ? 'sm:grid-cols-2' : ''} ${columns} dark:border-neutral-700 dark:bg-neutral-700`}>
        {tiers.map(([type, { price, allowance }]) => {
          const Icon = TYPE_ICONS[type] ?? Folder
          const isActive = activeType === type
          return (
            <li key={type}>
              <button
                type="button"
                onClick={() => onSelectType(isActive ? 'All' : type)}
                aria-pressed={isActive}
                className={`flex h-full w-full flex-col items-start gap-2 px-4 py-3.5 text-left transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-neutral-900'
                    : 'bg-neutral-50 hover:bg-white dark:bg-neutral-800/80 dark:hover:bg-neutral-900'
                }`}
              >
                <span className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  <Icon className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" strokeWidth={1.75} aria-hidden />
                  {type}
                </span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">
                  <span className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {formatAud(price)}
                  </span>{' '}
                  / {allowance === 'Per project' ? 'project' : allowance}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}


/** Hover bar on free cards: fetches a signed link from /api/download and saves the file. */
function FreeDownloadButton({ asset }) {
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'error'
  const [message, setMessage] = useState('')

  const start = async () => {
    setStatus('loading')
    try {
      await downloadAsset(asset.id)
      setStatus('idle')
    } catch (error) {
      console.error('[download] Could not download', asset.id, error)
      setMessage(error.message)
      setStatus('error')
    }
  }

  return (
    <button
      type="button"
      data-card-action
      onClick={start}
      disabled={status === 'loading'}
      className={`absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-neutral-900/90 px-3 py-2.5 text-xs font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100 disabled:cursor-wait ${
        status === 'idle' ? '' : 'translate-y-0 opacity-100'
      }`}
    >
      {status === 'loading' ? (
        <>
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden />
          Preparing download…
        </>
      ) : status === 'error' ? (
        <>
          <CircleAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="text-left text-[11px] leading-snug">
            {message} <span className="underline underline-offset-2">Try again</span>
          </span>
        </>
      ) : (
        <>
          <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Download
        </>
      )}
    </button>
  )
}

/** Bottom toast after an admin hides an asset (with Undo), or when hiding fails. */
function AdminNotice({ notice, onUndo, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, notice.kind === 'hidden' ? 6000 : 9000)
    return () => clearTimeout(timer)
  }, [notice, onDismiss])

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div
        role="status"
        className="fade-in flex max-w-lg items-center gap-4 border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-white shadow-2xl dark:border-neutral-200 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {notice.kind === 'hidden' ? (
          <>
            <EyeOff className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0 truncate">
              Hidden <span className="font-medium">{notice.asset.title}</span>
            </span>
            <button type="button" onClick={() => onUndo(notice.asset)} className="shrink-0 font-semibold underline underline-offset-4">
              Undo
            </button>
          </>
        ) : (
          <>
            <CircleAlert className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} aria-hidden />
            <span>{notice.message}</span>
          </>
        )}
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  )
}

/** Placeholder cards while the catalogue loads from Supabase. */
function GridSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading assets">
      <div className="h-5 w-24 animate-pulse bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-6 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="overflow-hidden border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="aspect-[4/3] animate-pulse bg-neutral-200 dark:bg-neutral-800" />
            <div className="space-y-2 px-4 py-3">
              <div className="h-3.5 w-3/4 animate-pulse bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-2.5 w-1/2 animate-pulse bg-neutral-100 dark:bg-neutral-800/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CatalogueError({ error, onRetry }) {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
      <CircleAlert className="mx-auto h-8 w-8 text-neutral-400" strokeWidth={1.5} aria-hidden />
      <p className="mt-4 font-medium">We couldn't load the asset library</p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{error?.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 border border-neutral-300 px-4 py-2 text-sm font-medium transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100"
      >
        <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Try again
      </button>
    </div>
  )
}


/**
 * The card's price chip. For premium assets it looks like a buy button but
 * opens the preview modal (the click bubbles to the card); checkout itself is
 * only started from the modal's "Buy now".
 */
function PriceTag({ asset, sale }) {
  if (asset.priceType === 'free') {
    return (
      <span className="shrink-0 border border-neutral-300 px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.15em] text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
        Free
      </span>
    )
  }

  // Weekday flash sale: the chip shows the sale price with the normal one struck through.
  const price = sale ? sale.priceCents / 100 : asset.price
  return (
    <button
      type="button"
      aria-label={`View ${asset.title}: ${formatAud(price)}${sale?.active ? ` (flash sale, normally ${formatAud(asset.price)})` : ''} (${asset.allowance})`}
      title="View details and buy"
      className="shrink-0 bg-neutral-900 px-2.5 py-1.5 text-right text-white shadow-sm transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-wait disabled:opacity-80 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus-visible:outline-neutral-100"
    >
      <span className="flex items-center justify-end gap-1 text-sm font-semibold leading-none tabular-nums">
        <ShoppingBag className="h-3 w-3 opacity-70" strokeWidth={2} aria-hidden />
        {sale?.active && <del className="text-[11px] font-medium opacity-60">{formatAud(asset.price)}</del>}
        {formatAud(price)}
      </span>
      <span className="mt-1 block text-[9px] font-medium uppercase leading-none tracking-[0.12em] opacity-70">
        {sale?.active ? 'Flash sale' : asset.allowance}
      </span>
    </button>
  )
}

function FormatBadge({ format }) {
  return (
    <span className="border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wider text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
      {format.replace('.', '')}
    </span>
  )
}

/**
 * Memoised: asset objects are module constants, so a card only re-renders when
 * it is shown for a different asset, not on every search keystroke.
 */
const AssetCard = memo(function AssetCard({ asset, isAdmin, onHide, onPreview }) {
  const [failed, setFailed] = useState(false)
  const showImage = asset.imageUrl && !failed
  // Flash-sale state, recomputed only when a sale starts or ends.
  const saleEpoch = useSaleEpoch()
  const sale = useMemo(
    () => (asset.priceType === 'premium' ? flashSale(asset.id, Math.round(asset.price * 100), Date.now()) : null),
    [asset, saleEpoch], // saleEpoch: recompute when a sale starts or ends
  )
  const saleActive = Boolean(sale?.active)

  // A click anywhere on the card opens the preview, except on controls that
  // act directly (free Download, admin Hide), which carry data-card-action.
  const openPreview = (event) => {
    if (event.target.closest('[data-card-action]')) return
    onPreview(asset)
  }

  return (
    <figure
      onClick={openPreview}
      className="group cursor-pointer overflow-hidden border border-neutral-200 bg-white transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        {showImage ? (
          // Keyboard access to the preview (the click itself bubbles to the card).
          <button
            type="button"
            aria-label={`Preview ${asset.title}`}
            className="block h-full w-full cursor-zoom-in"
          >
            <img
              src={asset.imageUrl}
              alt={asset.title}
              loading="lazy"
              draggable={false}
              onError={() => setFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
            Asset Preview
          </div>
        )}

        {saleActive && (
          // Right-angled triangle badge in the top-left corner (clip-path, no rounding).
          <span aria-hidden className="pointer-events-none absolute left-0 top-0 z-10 h-16 w-16 bg-red-600 [clip-path:polygon(0_0,100%_0,0_100%)]">
            <span className="absolute left-[3px] top-[17px] w-[38px] -rotate-45 text-center text-[10px] font-black uppercase leading-none tracking-[0.12em] text-white">
              Sale
            </span>
          </span>
        )}

        {asset.priceType === 'premium' ? null : asset.hasSource ? (
          <FreeDownloadButton asset={asset} />
        ) : (
          <span className="absolute left-3 top-3 bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500 dark:bg-neutral-950/80 dark:text-neutral-400">
            Coming soon
          </span>
        )}

        {isAdmin && (
          <button
            type="button"
            data-card-action
            onClick={() => onHide(asset)}
            aria-label={`Hide ${asset.title} from the library`}
            title="Hide from the library (admin)"
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 border border-neutral-200 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-700 shadow-sm backdrop-blur transition-colors hover:border-neutral-900 hover:bg-neutral-900 hover:text-white dark:border-neutral-700 dark:bg-neutral-950/85 dark:text-neutral-200 dark:hover:border-neutral-100 dark:hover:bg-neutral-100 dark:hover:text-neutral-900"
          >
            <EyeOff className="h-3 w-3" strokeWidth={2} aria-hidden />
            Hide
          </button>
        )}
      </div>

      <figcaption className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title={asset.title}>
          {saleActive && <span className="sr-only">On sale: </span>}
          {asset.title}
        </p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
          {asset.subject ? `${asset.type} · ${asset.subject}` : asset.type}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {asset.formats.map((format) => (
              <FormatBadge key={format} format={format} />
            ))}
          </div>
          <div className="flex min-w-0 flex-wrap items-end justify-end gap-x-3 gap-y-1.5">
            {saleActive && <FlashSaleCountdown variant="card" endsAt={sale.endsAt} />}
            <PriceTag asset={asset} sale={sale} />
          </div>
        </div>
      </figcaption>
    </figure>
  )
})
