import { memo, useMemo, useState } from 'react'
import {
  Armchair,
  Box,
  BrickWall,
  Car,
  Download,
  DraftingCompass,
  Layers,
  LayoutGrid,
  PersonStanding,
  Search,
  TreeDeciduous,
  X,
} from 'lucide-react'

/**
 * Asset catalogue.
 *
 * Thumbnails live in `public/assets-preview/`; the heavy source files are hosted
 * in the Supabase `assets` bucket so the repo stays small. Entries without a
 * `source` are placeholders (mock data) that show the layout until the real
 * files are imported: they render a grey preview tile and a "Coming soon" tag.
 */
const PREVIEW = '/assets-preview'
const STORAGE = 'https://eacxrglkllttghdpbrff.supabase.co/storage/v1/object/public/assets'

const ASSETS = [
  {
    title: 'Walking Figure',
    category: 'People',
    kind: '2D',
    image: 'Walking Figure.jpg',
    formats: ['.psd'],
    source: { filename: 'Walking Figure.psd', urls: [`${STORAGE}/walking-figure.psd`] },
  },
  {
    title: 'Sitting Figure',
    category: 'People',
    kind: '2D',
    image: 'Sitting Figure.jpg',
    formats: ['.psd'],
    source: { filename: 'Sitting Figure.psd', urls: [`${STORAGE}/sitting-figure.psd`] },
  },
  {
    title: 'Shrub Cluster',
    category: 'Vegetation',
    kind: '2D',
    image: 'Shrub Cluster.jpg',
    formats: ['.psd'],
    // The oversized PSD is split into parts and recombined in the browser.
    source: {
      filename: 'Shrub Cluster.psd',
      urls: [
        `${STORAGE}/shrub-cluster.psd.part1`,
        `${STORAGE}/shrub-cluster.psd.part2`,
        `${STORAGE}/shrub-cluster.psd.part3`,
      ],
    },
  },
  {
    title: 'Tree Section',
    category: 'Vegetation',
    kind: '2D',
    image: 'tree section.png',
    formats: ['.psd'],
    source: { filename: 'tree section.psd', urls: [`${STORAGE}/tree-section.psd`] },
  },
  {
    title: 'Bike',
    category: 'Vehicles',
    kind: '2D',
    image: 'bike.jpg',
    formats: ['.psd'],
    source: { filename: 'bike.psd', urls: [`${STORAGE}/bike.psd`] },
  },
  {
    title: 'Car',
    category: 'Vehicles',
    kind: '2D',
    image: 'car.png',
    formats: ['.dwg'],
    source: { filename: 'car.dwg', urls: [`${STORAGE}/car.dwg`] },
  },
  {
    title: 'Furniture Set',
    category: 'Furniture',
    kind: '2D',
    image: 'furniture set.png',
    formats: ['.ai'],
    source: { filename: 'furniture set.ai', urls: [`${STORAGE}/furniture-set.ai`] },
  },

  // Mock entries — replace with real files as they are imported.
  { title: 'Crowd Silhouettes', category: 'People', kind: '2D', formats: ['.ai', '.png'] },
  { title: 'Scale Figures 3D', category: 'People', kind: '3D', formats: ['.skp', '.3dm'] },
  { title: 'Deciduous Tree Elevations', category: 'Vegetation', kind: '2D', formats: ['.dwg', '.png'] },
  { title: 'Street Tree Model', category: 'Vegetation', kind: '3D', formats: ['.skp'] },
  { title: 'Parametric Planter', category: 'Vegetation', kind: '3D', formats: ['.3dm'] },
  { title: 'City Bus Elevation', category: 'Vehicles', kind: '2D', formats: ['.ai', '.png'] },
  { title: 'Hatchback Car Model', category: 'Vehicles', kind: '3D', formats: ['.skp', '.3dm'] },
  { title: 'Lounge Chair Pack', category: 'Furniture', kind: '3D', formats: ['.skp', '.dwg'] },
  { title: 'Office Desk Blocks', category: 'Furniture', kind: '3D', formats: ['.dwg', '.3dm'] },
  // Textures are material maps, so they sit outside the 2D / 3D split.
  { title: 'Board-Formed Concrete', category: 'Textures', formats: ['.png', '.psd'] },
  { title: 'Oak Timber Cladding', category: 'Textures', formats: ['.png'] },
  { title: 'Brick Stretcher Bond', category: 'Textures', formats: ['.png'] },
  { title: 'Curtain Wall Mullion', category: 'Details', kind: '2D', formats: ['.dwg'] },
  { title: 'Green Roof Build-up', category: 'Details', kind: '2D', formats: ['.dwg', '.ai'] },
  { title: 'Timber Stair Joint', category: 'Details', kind: '3D', formats: ['.3dm', '.skp'] },
].map((asset, index) => ({
  ...asset,
  id: index + 1,
  imageUrl: asset.image ? encodeURI(`${PREVIEW}/${asset.image}`) : null,
}))

/**
 * Category filters. "2D Assets" and "3D Models" are high-level classes that cut
 * across the subject categories, so they match on `kind` instead of `category`.
 */
const CATEGORIES = [
  { label: 'All', icon: LayoutGrid, matches: () => true },
  { label: '2D Assets', icon: Layers, matches: (asset) => asset.kind === '2D' },
  { label: '3D Models', icon: Box, matches: (asset) => asset.kind === '3D' },
  ...[
    ['People', PersonStanding],
    ['Vegetation', TreeDeciduous],
    ['Vehicles', Car],
    ['Furniture', Armchair],
    ['Textures', BrickWall],
    ['Details', DraftingCompass],
  ].map(([label, icon]) => ({ label, icon, matches: (asset) => asset.category === label })),
]
const FORMATS = ['.psd', '.ai', '.png', '.dwg', '.skp', '.3dm']

function triggerAnchorDownload(href, filename) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * Forces a download even when a browser would rather open the file. Fetches each
 * part as a blob (recombining split sources), saves it, and falls back to a plain
 * anchor download if the fetch fails.
 */
async function forceDownload(urls, filename) {
  try {
    const blobs = []
    for (const url of urls) {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Request failed')
      blobs.push(await response.blob())
    }

    const blob = blobs.length === 1 ? blobs[0] : new Blob(blobs)
    const objectUrl = URL.createObjectURL(blob)
    triggerAnchorDownload(objectUrl, filename)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
  } catch {
    triggerAnchorDownload(urls[0], filename)
  }
}

function matchesQuery(asset, query) {
  if (!query) return true
  const haystack = [asset.title, asset.category, asset.kind ?? '', ...asset.formats].join(' ').toLowerCase()
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

  const activeCategory = CATEGORIES.find((option) => option.label === category)

  const visibleAssets = useMemo(
    () =>
      ASSETS.filter(
        (asset) =>
          activeCategory.matches(asset) &&
          (!format || asset.formats.includes(format)) &&
          matchesQuery(asset, query.trim()),
      ),
    [query, activeCategory, format],
  )

  const hasFilters = query.trim() !== '' || category !== 'All' || format !== null
  const clearFilters = () => {
    setQuery('')
    setCategory('All')
    setFormat(null)
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
            Cutouts, CAD blocks, models and textures for your sections, elevations and renders.
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
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 lg:px-8">
          <FilterRow label="Category">
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-20 shrink-0 text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-400 dark:text-neutral-500">
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
      className={`group/pill flex items-center gap-2 rounded-md border px-4 py-1.5 text-xs font-medium tracking-wide transition-colors ${
        active
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
          : 'border-neutral-300 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-100 dark:hover:text-neutral-100'
      }`}
    >
      {Icon && (
        <Icon
          className={`h-3.5 w-3.5 shrink-0 transition-colors ${
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

        {asset.source ? (
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
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-neutral-800 dark:text-neutral-200">{asset.title}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
            {asset.category}
          </span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {asset.formats.map((format) => (
            <FormatBadge key={format} format={format} />
          ))}
        </div>
      </figcaption>
    </figure>
  )
})
