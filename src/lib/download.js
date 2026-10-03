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
export async function forceDownload(urls, filename) {
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

/**
 * Asks /api/download for short-lived signed links to an asset's source file(s)
 * in the private bucket, then downloads them. Premium assets need the paid
 * Stripe Checkout session id.
 */
export async function downloadAsset(assetId, sessionId) {
  const params = new URLSearchParams({ asset: assetId })
  if (sessionId) params.set('session_id', sessionId)

  let response
  try {
    response = await fetch(`/api/download?${params}`)
  } catch (networkError) {
    throw new Error(`Network error reaching /api/download: ${networkError.message}`, { cause: networkError })
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.urls?.length) {
    if (data?.error) throw new Error(data.error)
    if (response.status === 404) {
      throw new Error('Download API not found. Test on the live site or run `vercel dev`; `npm run dev` has no /api.')
    }
    throw new Error(`Download API returned HTTP ${response.status}.`)
  }
  await forceDownload(data.urls, data.filename)
}
