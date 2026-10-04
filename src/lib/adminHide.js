/**
 * Admin hide / un-hide via /api/hide. The server checks the admin passcode
 * (ADMIN_PASSCODE in Vercel); it is asked for once and kept for this tab only.
 */
const PASSCODE_KEY = 'archigrads-admin-passcode'

function readPasscode() {
  try {
    return sessionStorage.getItem(PASSCODE_KEY)
  } catch {
    return null
  }
}

function storePasscode(value) {
  try {
    if (value) sessionStorage.setItem(PASSCODE_KEY, value)
    else sessionStorage.removeItem(PASSCODE_KEY)
  } catch {
    // Storage blocked: the passcode is simply asked for again next time.
  }
}

export class HideCancelled extends Error {}

export async function setAssetHidden(assetId, hidden = true) {
  let passcode = readPasscode()
  if (!passcode) {
    passcode = window.prompt('Admin passcode (set as ADMIN_PASSCODE in Vercel):')?.trim()
    if (!passcode) throw new HideCancelled('Cancelled')
  }

  let response
  try {
    response = await fetch('/api/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-passcode': passcode },
      body: JSON.stringify({ assetId, hidden }),
    })
  } catch (networkError) {
    throw new Error(`Network error reaching /api/hide: ${networkError.message}`, { cause: networkError })
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) storePasscode(null) // ask again next time
    if (data?.error) throw new Error(data.error)
    if (response.status === 404) throw new Error('Hide API not found. Test on the live site or run `vercel dev`.')
    throw new Error(`Hide API returned HTTP ${response.status}.`)
  }
  storePasscode(passcode)
  return data
}
