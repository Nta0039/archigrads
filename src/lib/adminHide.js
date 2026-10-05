/** Admin hide / un-hide: one request to /api/hide, no prompt or confirmation. */
export async function setAssetHidden(assetId, hidden = true) {
  let response
  try {
    response = await fetch('/api/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, hidden }),
    })
  } catch (networkError) {
    throw new Error(`Network error reaching /api/hide: ${networkError.message}`, { cause: networkError })
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (data?.error) throw new Error(data.error)
    if (response.status === 404) throw new Error('Hide API not found. Test on the live site or run `vercel dev`.')
    throw new Error(`Hide API returned HTTP ${response.status}.`)
  }
  return data
}
