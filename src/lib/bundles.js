/**
 * Bundle offers, shared by the preview modal and the API (checkout, session,
 * download). The bundle price lives here, on the server side of checkout, so a
 * visitor cannot change it. Each bundle lists the exact asset slugs it unlocks.
 */
export const BUNDLES = {
  'old-peoples-home-skp': {
    id: 'old-peoples-home-skp',
    title: "Old People's Home · SketchUp bundle (5 files)",
    collection: "Old People's Home",
    // The bundle's own card in the library (an assets row with no file of its own).
    listingSlug: 'old-peoples-home-bundle',
    format: '.skp',
    priceCents: 1500, // A$15 for all five (A$25 bought separately)
    assetIds: ['old-peoples-home-4', 'old-peoples-home-5', 'old-peoples-home-6', 'old-peoples-home-7', 'old-peoples-home-8'],
  },
}

/** The bundle whose library card has this slug, or null. */
export function bundleForListing(slug) {
  return Object.values(BUNDLES).find((bundle) => bundle.listingSlug === slug) ?? null
}

/** The bundle an asset belongs to, or null. */
export function bundleForAsset(assetId) {
  return Object.values(BUNDLES).find((bundle) => bundle.assetIds.includes(assetId)) ?? null
}
