import { memo, useMemo, useState } from 'react'
import {
  Box,
  Boxes,
  CircleAlert,
  Crown,
  Download,
  FolderOpen,
  Gift,
  Image,
  Images,
  LayoutGrid,
  LoaderCircle,
  ScrollText,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react'
import { ASSETS, PRODUCT_TYPES, formatAud } from '../data/catalogue'
import { forceDownload } from '../lib/download'

const TYPE_ICONS = {
  '2D Singles': Image,
  '2D Collections': Images,
  'Code & Standards': ScrollText,
  'BIM Families': Boxes,
  'Detailed Models': Box,
  'Project Proposals': FolderOpen,
}

const CATEGORIES = [
  { label: 'All', icon: LayoutGrid, matches: () => true },
  ...Object.keys(PRODUCT_TYPES).map((label) => ({
    label,
    icon: TYPE_ICONS[label],
    matches: (asset) => asset.type === label,
  })),
]

const PRICE_TYPES = [
  { value: 'free', label: 'Free', icon: Gift },
  { value: 'premium', label: 'Premium', icon: Crown },
]

const FORMATS = ['.psd', '.ai', '.png', '.dwg', '.pdf', '.rfa', '.rvt', '.3dm']

function matchesQuery(asset, query) {
  if (!query) return true
  const haystack = [asset.title, asset.type, asset.subject, asset.priceType, ...asset.formats].join(' ').toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((word) => haystack.includes(word))
}

/** The asset library: hero search, category / format filters and the grid. */
export default function AssetsLibraryPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [format, setFormat] = useState(null)
  const [priceType, setPriceType] = useState(null) // 'free' | 'premium' | null

  const activeCategory = CATEGORIES.find((option) => option.label === category)

  const visibleAssets = useMemo(
    () =>
      ASSETS.filter(
        (asset) =>
          (!priceType || asset.priceType === priceType) &&
          activeCategory.matches(asset) &&
          (!format || asset.formats.includes(format)) &&
          matchesQuery(asset, query.trim()),
      ),
    [query, priceType, activeCategory, format],
  )

  const hasFilters = query.trim() !== '' || priceType !== null || category !== 'All' || format !== null
  const clearFilters = () => {
    setQuery('')
    setCategory('All')
    setFormat(null)
    setPriceType(null)
  }

  return (
    <>
      {/* Hero & search */}
      <section className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-6 py-16 text-center sm:py-24 lg:px-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-400 dark:text-neutral-500">
            Vector Assets Library
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Premium Architectural Assets
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-neutral-500 dark:text-neutral-400">
            Free 2D cutouts, plus premium collections, NCC code packs, Revit families, detailed models and full project proposals.
          </p>

          <form
            role="search"
            onSubmit={(event) => event.preventDefault()}
            className="mx-auto mt-10 flex max-w-3xl items-stretch overflow-hidden rounded-lg border border-neutral-300 bg-white transition-colors focus-within:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:focus-within:border-neutral-100"
          >
            <label htmlFor="asset-search" className="flex items-center pl-5 text-neutral-400 dark:text-neutral-500">
              <Search className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              <span className="sr-only">Search assets</span>
            </label>
            <input
              id="asset-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people, trees, furniture, textures…"
              className="min-w-0 flex-1 bg-transparent px-4 py-4 text-base outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="flex items-center px-3 text-neutral-400 transition-colors hover:text-neutral-900 dark:text-neutral-500 dark:hover:text-neutral-100"
              >
                <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </button>
            )}
            <button
              type="submit"
              className="bg-neutral-900 px-6 text-sm font-medium text-white transition-colors hover:bg-neutral-700 sm:px-8 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-8 lg:px-8">
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
            {CATEGORIES.map(({ label, icon }) => (
              <Pill key={label} icon={icon} active={category === label} onClick={() => setCategory(label)}>
                {label}
              </Pill>
            ))}
          </FilterRow>
          <FilterRow label="Format">
            <Pill active={format === null} onClick={() => setFormat(null)}>
              Any
            </Pill>
            {FORMATS.map((value) => (
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
        {priceType === 'premium' && <PricingRules activeType={category} onSelectType={setCategory} />}

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
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>

        {visibleAssets.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No assets match these filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 rounded-md border border-neutral-300 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100"
            >
              Clear filters
            </button>
          </div>
        )}
      </main>
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

function Pill({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group/pill flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors sm:text-base ${
        active
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
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
      {children}
    </button>
  )
}

/**
 * Premium pricing summary, shown only while the Premium filter is on. Built
 * from PRODUCT_TYPES so it can never disagree with the price tags on the cards.
 * Each tier doubles as a shortcut to that category.
 */
function PricingRules({ activeType, onSelectType }) {
  const tiers = Object.entries(PRODUCT_TYPES).filter(([, tier]) => tier.price)

  return (
    <section
      aria-labelledby="pricing-rules-title"
      className="fade-in mb-8 rounded-lg border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-800/50"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="pricing-rules-title" className="flex items-center gap-2 text-sm font-semibold">
          <Crown className="h-4 w-4 text-neutral-500 dark:text-neutral-400" strokeWidth={1.75} aria-hidden />
          Premium pricing
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">All prices in Australian dollars (AUD)</p>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-5 dark:border-neutral-700 dark:bg-neutral-700">
        {tiers.map(([type, { price, allowance }]) => {
          const Icon = TYPE_ICONS[type]
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

/**
 * POSTs to the /api/checkout serverless function and returns the Stripe-hosted
 * checkout URL. Every failure becomes an Error whose message says what actually
 * went wrong (network, missing API route, or the server's own error message).
 */
async function createCheckoutSession(assetId) {
  let response
  try {
    response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId }),
    })
  } catch (networkError) {
    throw new Error(`Network error reaching /api/checkout: ${networkError.message}`, { cause: networkError })
  }

  const body = await response.text()
  let data = null
  try {
    data = JSON.parse(body)
  } catch {
    // Not JSON: usually an HTML 404 page because the API route isn't running.
  }

  if (!response.ok) {
    if (data?.error) throw new Error(data.error)
    if (response.status === 404) {
      // `npm run dev` (plain Vite) does not run Vercel functions in /api.
      throw new Error(
        'Checkout API not found. Test on the live site or run `vercel dev` locally; `npm run dev` has no /api.',
      )
    }
    throw new Error(`Checkout API returned HTTP ${response.status}: ${body.slice(0, 120)}`)
  }
  if (!data?.url) throw new Error(`Checkout API returned no checkout URL: ${body.slice(0, 120)}`)
  return data.url
}

/** Starts Stripe Checkout for one asset and redirects; exposes loading / error state. */
function useCheckout(asset) {
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'error'
  const [message, setMessage] = useState('')

  const start = async () => {
    setStatus('loading')
    setMessage('')
    try {
      const url = await createCheckoutSession(asset.id)
      window.location.assign(url)
    } catch (error) {
      console.error('[checkout] Could not start Stripe Checkout:', error)
      setMessage(error.message)
      setStatus('error')
    }
  }

  return { status, message, start }
}

/**
 * The card's price chip. For premium assets it is the Buy button: it shows the
 * AUD price and download allowance and starts Stripe Checkout when clicked.
 */
function PriceTag({ asset, checkout }) {
  if (asset.priceType === 'free') {
    return (
      <span className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.15em] text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
        Free
      </span>
    )
  }

  const loading = checkout.status === 'loading'
  return (
    <button
      type="button"
      onClick={checkout.start}
      disabled={loading}
      aria-label={`Buy ${asset.title} for ${formatAud(asset.price)} (${asset.allowance})`}
      title="Buy with Stripe (test mode)"
      className="shrink-0 rounded-md bg-neutral-900 px-2.5 py-1.5 text-right text-white shadow-sm transition-colors hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-wait disabled:opacity-80 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus-visible:outline-neutral-100"
    >
      <span className="flex items-center justify-end gap-1 text-sm font-semibold leading-none tabular-nums">
        {loading ? (
          <LoaderCircle className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden />
        ) : (
          <ShoppingBag className="h-3 w-3 opacity-70" strokeWidth={2} aria-hidden />
        )}
        {formatAud(asset.price)}
      </span>
      <span className="mt-1 block text-[9px] font-medium uppercase leading-none tracking-[0.12em] opacity-70">
        {loading ? 'Opening checkout…' : asset.allowance}
      </span>
    </button>
  )
}

function FormatBadge({ format }) {
  return (
    <span className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wider text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
      {format.replace('.', '')}
    </span>
  )
}

/**
 * Memoised: asset objects are module constants, so a card only re-renders when
 * it is shown for a different asset, not on every search keystroke.
 */
const AssetCard = memo(function AssetCard({ asset }) {
  const [failed, setFailed] = useState(false)
  const showImage = asset.imageUrl && !failed
  const checkout = useCheckout(asset)

  return (
    <figure className="group overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-600">
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200 dark:bg-neutral-800">
        {showImage ? (
          <img
            src={asset.imageUrl}
            alt={asset.title}
            loading="lazy"
            draggable={false}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
            Asset Preview
          </div>
        )}

        {asset.priceType === 'premium' ? null : asset.source ? (
          <a
            href={asset.source.urls[0]}
            download={asset.source.filename}
            onClick={(event) => {
              event.preventDefault()
              forceDownload(asset.source.urls, asset.source.filename)
            }}
            className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-neutral-900/90 py-2.5 text-xs font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus:translate-y-0 focus:opacity-100"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Download
          </a>
        ) : (
          <span className="absolute left-3 top-3 rounded bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500 dark:bg-neutral-950/80 dark:text-neutral-400">
            Coming soon
          </span>
        )}
      </div>

      <figcaption className="border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title={asset.title}>
          {asset.title}
        </p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
          {asset.type} · {asset.subject}
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {asset.formats.map((format) => (
              <FormatBadge key={format} format={format} />
            ))}
          </div>
          <PriceTag asset={asset} checkout={checkout} />
        </div>
        {checkout.status === 'error' && (
          <p role="alert" className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-snug text-neutral-600 dark:text-neutral-300">
            <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span>{checkout.message}</span>
          </p>
        )}
      </figcaption>
    </figure>
  )
})
