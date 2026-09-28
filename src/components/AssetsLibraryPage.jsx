import { useState } from 'react'
import { ArrowLeft, Download } from 'lucide-react'

/**
 * Asset catalogue.
 *
 * The browser cannot read the folder at runtime, so this list mirrors the files
 * currently in `public/assets-preview/`. Assets are grouped by base name: the
 * image (png/jpg/jpeg/svg/webp) becomes the thumbnail, and a paired source file
 * (psd/ai/dwg/dxf/zip/obj/skp/3dm) becomes the download. Drop new files in and
 * add their names here.
 */
const BASE_PATH = '/assets-preview'

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg', 'webp']
const SOURCE_EXTENSIONS = ['psd', 'ai', 'dwg', 'dxf', 'zip', 'obj', 'skp', '3dm']

const FILES = [
  'bike.jpg',
  'bike.psd',
  'car.dwg',
  'car.png',
  'furniture set.ai',
  'furniture set.png',
  'Shrub Cluster.jpg',
  'Shrub Cluster.psd',
  'Sitting Figure.jpg',
  'Sitting Figure.psd',
  'tree section.png',
  'tree section.psd',
  'Walking Figure.jpg',
  'Walking Figure.psd',
]

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

/** Groups the flat file list into { title, imageUrl, downloadUrl, category }. */
function buildAssets(files) {
  const groups = new Map()

  for (const file of files) {
    const dot = file.lastIndexOf('.')
    const base = dot === -1 ? file : file.slice(0, dot)
    const extension = dot === -1 ? '' : file.slice(dot + 1).toLowerCase()

    if (!groups.has(base)) groups.set(base, { base })
    const group = groups.get(base)

    if (IMAGE_EXTENSIONS.includes(extension)) group.image = file
    else if (SOURCE_EXTENSIONS.includes(extension)) group.source = group.source || file
  }

  return [...groups.values()]
    .filter((group) => group.image)
    .map((group, index) => ({
      id: index + 1,
      title: group.base,
      category: categorise(group.base),
      imageUrl: `${BASE_PATH}/${group.image}`,
      downloadUrl: `${BASE_PATH}/${group.source || group.image}`,
    }))
}

const ASSETS = buildAssets(FILES)

const CATEGORIES = ['All', 'People', 'Vegetation', 'Vehicles', 'Furniture']

const fileNameFrom = (url) => decodeURIComponent(url.split('/').pop())

function triggerAnchorDownload(href, filename) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * Forces a download even when a browser would rather open the file. Fetches the
 * file as a blob and saves it; falls back to a plain anchor download.
 */
async function forceDownload(url, filename) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Request failed')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerAnchorDownload(objectUrl, filename)
    // Give the download a moment before releasing the blob URL.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
  } catch {
    triggerAnchorDownload(url, filename)
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
  const imageUrl = encodeURI(asset.imageUrl)
  const downloadUrl = encodeURI(asset.downloadUrl)
  const filename = fileNameFrom(asset.downloadUrl)

  return (
    <figure className="group overflow-hidden border border-neutral-200 bg-white">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-200">
        {failed ? (
          <div className="flex h-full w-full items-center justify-center bg-gray-200 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-500">
            Asset Preview
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={asset.title}
            loading="lazy"
            draggable={false}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        )}

        <a
          href={downloadUrl}
          download={filename}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            forceDownload(downloadUrl, filename)
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
