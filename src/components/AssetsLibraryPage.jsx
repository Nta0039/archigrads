import { useState } from 'react'
import { ArrowLeft, Download } from 'lucide-react'

/**
 * Asset catalogue.
 *
 * Thumbnails live in `public/assets-preview/`; the heavy source files are hosted
 * in the Supabase `assets` bucket so the repo stays small. Add a new thumbnail
 * to FILES and, if it has a downloadable source, an entry to REMOTE_SOURCES.
 */
const BASE_PATH = '/assets-preview'
const STORAGE = 'https://eacxrglkllttghdpbrff.supabase.co/storage/v1/object/public/assets'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg', 'webp']

// Thumbnails present in public/assets-preview.
const FILES = [
  'bike.jpg',
  'car.png',
  'furniture set.png',
  'Shrub Cluster.jpg',
  'Sitting Figure.jpg',
  'tree section.png',
  'Walking Figure.jpg',
]

// Hosted source files, keyed by thumbnail base name. The oversized PSD is split
// into parts and recombined in the browser on download.
const REMOTE_SOURCES = {
  bike: { filename: 'bike.psd', urls: [`${STORAGE}/bike.psd`] },
  car: { filename: 'car.dwg', urls: [`${STORAGE}/car.dwg`] },
  'furniture set': { filename: 'furniture set.ai', urls: [`${STORAGE}/furniture-set.ai`] },
  'Shrub Cluster': {
    filename: 'Shrub Cluster.psd',
    urls: [
      `${STORAGE}/shrub-cluster.psd.part1`,
      `${STORAGE}/shrub-cluster.psd.part2`,
      `${STORAGE}/shrub-cluster.psd.part3`,
    ],
  },
  'Sitting Figure': { filename: 'Sitting Figure.psd', urls: [`${STORAGE}/sitting-figure.psd`] },
  'tree section': { filename: 'tree section.psd', urls: [`${STORAGE}/tree-section.psd`] },
  'Walking Figure': { filename: 'Walking Figure.psd', urls: [`${STORAGE}/walking-figure.psd`] },
}

/** Keyword-based categorisation so new files land in a sensible bucket. */
function categorise(name) {
  const value = name.toLowerCase()
  if (/(tree|plant|shrub|grass|flower|leaf|vegetation|bush|hedge|palm)/.test(value)) {
    return 'Vegetation'
  }
  if (/(car|bus|truck|van|bike|bicycle|motor|vehicle|taxi|scooter)/.test(value)) {
    return 'Vehicles'
  }
  if (/(man|woman|person|people|figure|human|sitting|walking|standing|child)/.test(value)) {
    return 'People'
  }
  if (/(chair|table|sofa|furniture|desk|stool|bed|lamp|shelf|bench)/.test(value)) {
    return 'Furniture'
  }
  return 'Other'
}

/** Builds the catalogue from the thumbnail list, pairing each with its source. */
function buildAssets(files) {
  const groups = new Map()

  for (const file of files) {
    const dot = file.lastIndexOf('.')
    const base = dot === -1 ? file : file.slice(0, dot)
    const extension = dot === -1 ? '' : file.slice(dot + 1).toLowerCase()

    if (!groups.has(base)) groups.set(base, { base })
    const group = groups.get(base)
    if (IMAGE_EXTENSIONS.includes(extension)) group.image = file
  }

  return [...groups.values()]
    .filter((group) => group.image)
    .map((group, index) => {
      const remote = REMOTE_SOURCES[group.base]
      return {
        id: index + 1,
        title: group.base,
        category: categorise(group.base),
        imageUrl: encodeURI(`${BASE_PATH}/${group.image}`),
        downloadUrls: remote ? remote.urls : [encodeURI(`${BASE_PATH}/${group.image}`)],
        fileName: remote ? remote.filename : group.image,
      }
    })
}

const ASSETS = buildAssets(FILES)

const CATEGORIES = ['All', 'People', 'Vegetation', 'Vehicles', 'Furniture']

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

export default function AssetsLibraryPage({ onBack }) {
  const [activeCategory, setActiveCategory] = useState('All')

  const visibleAssets =
    activeCategory === 'All' ? ASSETS : ASSETS.filter((asset) => asset.category === activeCategory)

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Back to Home
        </button>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-24 lg:px-8">
        <header className="max-w-2xl border-t border-neutral-200 pt-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-400">
            Vector Assets Library
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Cutouts, blocks and materials.
          </h1>
          <p className="mt-5 leading-relaxed text-neutral-500">
            A curated collection of architectural vector assets for your sections and elevations.
            Browse by category and download the source files.
          </p>
        </header>

        {/* Category filter */}
        <div className="mt-12 flex flex-wrap items-center gap-2 border-y border-neutral-200 py-4">
          {CATEGORIES.map((category) => {
            const isActive = category === activeCategory
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] transition-colors ${
                  isActive
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {category}
              </button>
            )
          })}
        </div>

        {/* Asset grid */}
        <div className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {visibleAssets.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>

        {visibleAssets.length === 0 && (
          <p className="mt-16 text-center text-sm text-neutral-400">No assets in this category yet.</p>
        )}
      </main>
    </div>
  )
}

function AssetCard({ asset }) {
  const [failed, setFailed] = useState(false)

  return (
    <figure className="group overflow-hidden border border-neutral-200 bg-white">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
        {failed ? (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-500">
            Asset Preview
          </div>
        ) : (
          <img
            src={asset.imageUrl}
            alt={asset.title}
            loading="lazy"
            draggable={false}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        )}

        <a
          href={asset.downloadUrls[0]}
          download={asset.fileName}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            forceDownload(asset.downloadUrls, asset.fileName)
          }}
          className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-neutral-900/90 py-2.5 text-xs font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          Download
        </a>
      </div>

      <figcaption className="flex items-center justify-between gap-2 border-t border-neutral-200 px-4 py-3">
        <span className="truncate text-sm text-neutral-800">{asset.title}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-neutral-400">
          {asset.category}
        </span>
      </figcaption>
    </figure>
  )
}
