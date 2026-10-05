/**
 * Asset catalogue, loaded from Supabase (see database-setup.sql):
 *
 *   table  categories  name, price_cents (null = free), allowance, sort_order
 *   table  assets      slug, title, category, subject, formats, thumbnail_path,
 *                      source_paths, source_filename, price_cents (optional
 *                      per-asset override), is_published, is_hidden,
 *                      sort_order
 *   bucket thumbnails    public previews (thumbnail_path)
 *   bucket source-files  private source files (source_paths); only the API hands
 *                        out short-lived signed links to them
 *
 * Plain JS with no browser-only imports, so the Vercel API functions share it.
 */
export const THUMBNAIL_BUCKET = 'thumbnails'
export const SOURCE_BUCKET = 'source-files'

export const formatAud = (amount) => `A$${amount}`

const CATEGORY_COLUMNS = 'name, price_cents, allowance, sort_order'
// Hidden by an admin (is_hidden = true) means gone from the site, the download
// API and checkout alike; null counts as visible.
const NOT_HIDDEN = 'is_hidden.is.null,is_hidden.eq.false'

const ASSET_COLUMNS =
  'slug, title, category, subject, formats, thumbnail_path, source_paths, source_filename, price_cents, sort_order'

function toCategory(row) {
  return {
    name: row.name,
    price: row.price_cents ? row.price_cents / 100 : null,
    allowance: row.allowance ?? null,
  }
}

/** Database row -> the asset shape the UI uses. */
function toAsset(row, category, client) {
  // An asset's own price_cents (e.g. the A$1 live demo) overrides its category.
  const price = row.price_cents ? row.price_cents / 100 : (category?.price ?? null)
  return {
    id: row.slug,
    title: row.title,
    type: row.category,
    subject: row.subject ?? '',
    formats: row.formats ?? [],
    priceType: price ? 'premium' : 'free',
    price,
    allowance: category?.allowance ?? (row.price_cents ? 'Single purchase' : null),
    imageUrl: row.thumbnail_path
      ? client.storage.from(THUMBNAIL_BUCKET).getPublicUrl(row.thumbnail_path).data.publicUrl
      : null,
    hasSource: (row.source_paths ?? []).length > 0,
    // Paths inside the private bucket; useless without a signed URL from the API.
    sourcePaths: row.source_paths ?? [],
    sourceFilename: row.source_filename ?? null,
  }
}

/** Loads every category and published asset, in display order. */
export async function fetchCatalogue(client) {
  const [categoriesResult, assetsResult] = await Promise.all([
    client.from('categories').select(CATEGORY_COLUMNS).order('sort_order'),
    client.from('assets').select(ASSET_COLUMNS).eq('is_published', true).or(NOT_HIDDEN).order('sort_order'),
  ])
  if (categoriesResult.error) throw new Error(`Could not load categories: ${categoriesResult.error.message}`)
  if (assetsResult.error) throw new Error(`Could not load assets: ${assetsResult.error.message}`)

  const categories = categoriesResult.data.map(toCategory)
  const byName = new Map(categories.map((category) => [category.name, category]))
  const assets = assetsResult.data.map((row) => toAsset(row, byName.get(row.category), client))
  return { categories, assets }
}

/** One published asset by slug (with its category's price), or null. */
export async function fetchAsset(client, slug) {
  const { data: row, error } = await client
    .from('assets')
    .select(ASSET_COLUMNS)
    .eq('slug', slug)
    .eq('is_published', true)
    .or(NOT_HIDDEN)
    .maybeSingle()
  if (error) throw new Error(`Could not load asset: ${error.message}`)
  if (!row) return null

  const { data: category, error: categoryError } = await client
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .eq('name', row.category)
    .maybeSingle()
  if (categoryError) throw new Error(`Could not load category: ${categoryError.message}`)
  return toAsset(row, category ? toCategory(category) : null, client)
}
