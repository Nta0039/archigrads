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
