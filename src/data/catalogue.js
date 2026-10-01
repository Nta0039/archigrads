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

/**
 * Pricing model (AUD). Every product type has one price and one download
 * allowance, so an asset's price comes from its type rather than being typed
 * per item. 2D Singles are free.
 */
export const PRODUCT_TYPES = {
  '2D Singles': { price: null },
  '2D Collections': { price: 10, allowance: '50 downloads' },
  'Code & Standards': { price: 20, allowance: '20 downloads' },
  'BIM Families': { price: 10, allowance: '20 downloads' },
  'Detailed Models': { price: 20, allowance: '10 downloads' },
  'Project Proposals': { price: 10, allowance: 'Per project' },
}

export const formatAud = (amount) => `A$${amount}`

/** Placeholder thumbnail that doubles as the (fake) download until real files exist. */
function placeholder(image) {
  return {
    image,
    source: { filename: image.replace('dummy-', 'archigrads-preview-'), urls: [`${PREVIEW}/${image}`] },
  }
}

export const ASSETS = [
  // 2D Singles: the real, downloadable files.
  {
    title: 'Walking Figure',
    type: '2D Singles',
    subject: 'People',
    image: 'Walking Figure.jpg',
    formats: ['.psd'],
    source: { filename: 'Walking Figure.psd', urls: [`${STORAGE}/walking-figure.psd`] },
  },
  {
    title: 'Sitting Figure',
    type: '2D Singles',
    subject: 'People',
    image: 'Sitting Figure.jpg',
    formats: ['.psd'],
    source: { filename: 'Sitting Figure.psd', urls: [`${STORAGE}/sitting-figure.psd`] },
  },
  {
    title: 'Shrub Cluster',
    type: '2D Singles',
    subject: 'Vegetation',
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
    type: '2D Singles',
    subject: 'Vegetation',
    image: 'tree section.png',
    formats: ['.psd'],
    source: { filename: 'tree section.psd', urls: [`${STORAGE}/tree-section.psd`] },
  },
  {
    title: 'Bike',
    type: '2D Singles',
    subject: 'Vehicles',
    image: 'bike.jpg',
    formats: ['.psd'],
    source: { filename: 'bike.psd', urls: [`${STORAGE}/bike.psd`] },
  },
  {
    title: 'Car',
    type: '2D Singles',
    subject: 'Vehicles',
    image: 'car.png',
    formats: ['.dwg'],
    source: { filename: 'car.dwg', urls: [`${STORAGE}/car.dwg`] },
  },
  {
    title: 'Furniture Set',
    type: '2D Singles',
    subject: 'Furniture',
    image: 'furniture set.png',
    formats: ['.ai'],
    source: { filename: 'furniture set.ai', urls: [`${STORAGE}/furniture-set.ai`] },
  },

  // Mock entries — replace with real files as they are imported. Premium mocks use
  // a placeholder thumbnail, and "Download" saves that thumbnail for now.
  { title: 'Brick Stretcher Bond', type: '2D Singles', subject: 'Textures', formats: ['.png'] },
  { title: 'People Cutout Collection', type: '2D Collections', subject: 'People', formats: ['.psd', '.png'], ...placeholder('dummy-2d-collection.png') },
  { title: 'Vegetation Elevation Collection', type: '2D Collections', subject: 'Vegetation', formats: ['.dwg', '.png'], ...placeholder('dummy-2d-collection.png') },
  { title: 'Street Furniture Collection', type: '2D Collections', subject: 'Furniture', formats: ['.ai', '.dwg'], ...placeholder('dummy-2d-collection.png') },
  { title: 'NCC Volume One Compliance Pack', type: 'Code & Standards', subject: 'NCC', formats: ['.pdf'], ...placeholder('dummy-ncc.png') },
  { title: 'Accessibility (AS 1428.1) Pack', type: 'Code & Standards', subject: 'NCC', formats: ['.pdf', '.dwg'], ...placeholder('dummy-ncc.png') },
  { title: 'Fire Safety Checklist Pack', type: 'Code & Standards', subject: 'NCC', formats: ['.pdf'], ...placeholder('dummy-ncc.png') },
  { title: 'Door Families', type: 'BIM Families', subject: 'Revit', formats: ['.rfa'], ...placeholder('dummy-revit-family.png') },
  { title: 'Window Families', type: 'BIM Families', subject: 'Revit', formats: ['.rfa'], ...placeholder('dummy-revit-family.png') },
  { title: 'Furniture Families', type: 'BIM Families', subject: 'Revit', formats: ['.rfa'], ...placeholder('dummy-revit-family.png') },
  { title: 'CLT Stair Assembly', type: 'Detailed Models', subject: 'Revit', formats: ['.rvt'], ...placeholder('dummy-revit-model.png') },
  { title: 'Facade Fin System', type: 'Detailed Models', subject: 'Rhino', formats: ['.3dm'], ...placeholder('dummy-rhino-model.png') },
  { title: 'Timber Pavilion', type: 'Detailed Models', subject: 'Revit / Rhino', formats: ['.rvt', '.3dm'], ...placeholder('dummy-revit-model.png') },
  { title: 'Community Library Proposal', type: 'Project Proposals', subject: 'Civic', formats: ['.pdf', '.rvt'], ...placeholder('dummy-project-proposal.png') },
  { title: 'Mixed-Use Tower Proposal', type: 'Project Proposals', subject: 'Mixed use', formats: ['.pdf', '.3dm'], ...placeholder('dummy-project-proposal.png') },
  { title: 'Pocket Park Proposal', type: 'Project Proposals', subject: 'Landscape', formats: ['.pdf', '.dwg'], ...placeholder('dummy-project-proposal.png') },
].map((asset) => {
  const { price, allowance } = PRODUCT_TYPES[asset.type]
  return {
    ...asset,
    // Stable id from the title; the checkout API looks assets up by it.
    id: asset.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    priceType: price ? 'premium' : 'free',
    price,
    allowance,
    imageUrl: asset.image ? encodeURI(`${PREVIEW}/${asset.image}`) : null,
  }
})

export function findAsset(id) {
  return ASSETS.find((asset) => asset.id === id) ?? null
}
