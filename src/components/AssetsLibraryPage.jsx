import { useState } from 'react'
import { ArrowLeft, Download } from 'lucide-react'

/**
 * Dummy catalogue. The image paths point at files you drop into
 * `public/assets-preview/`. Until those files exist, each card falls back to a
 * neutral placeholder so the grid keeps its shape.
 */
const ASSETS = [
  { id: 1, title: 'Standing Figure', category: 'People', imageUrl: '/assets-preview/asset-1.png' },
  { id: 2, title: 'Walking Figure', category: 'People', imageUrl: '/assets-preview/asset-2.png' },
  { id: 3, title: 'Oak Tree Plan', category: 'Vegetation', imageUrl: '/assets-preview/asset-3.png' },
  { id: 4, title: 'Shrub Cluster', category: 'Vegetation', imageUrl: '/assets-preview/asset-4.png' },
  { id: 5, title: 'Compact Car', category: 'Vehicles', imageUrl: '/assets-preview/asset-5.png' },
  { id: 6, title: 'Delivery Van', category: 'Vehicles', imageUrl: '/assets-preview/asset-6.png' },
  { id: 7, title: 'Lounge Chair', category: 'Furniture', imageUrl: '/assets-preview/asset-7.png' },
  { id: 8, title: 'Dining Set', category: 'Furniture', imageUrl: '/assets-preview/asset-8.png' },
]

const CATEGORIES = ['All', 'People', 'Vegetation', 'Vehicles', 'Furniture']

/**
 * Vector Assets Library. A filterable, downloadable catalogue of architectural
 * cutouts. Keeps the monochrome, architectural aesthetic of the rest of the app.
 */
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
            Browse by category and download what you need.
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
          href={asset.imageUrl}
          download
          onClick={(event) => event.stopPropagation()}
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
