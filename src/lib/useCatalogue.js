import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { fetchCatalogue } from './catalogue'
import { isSupabaseConfigured, supabase } from './supabase'

// One request per page load, shared by every component that needs the catalogue.
let pending = null

function loadCatalogue() {
  if (!isSupabaseConfigured) {
    return Promise.reject(new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'))
  }
  pending ??= fetchCatalogue(supabase).catch((error) => {
    pending = null // allow a retry
    throw error
  })
  return pending
}

/** Forget the cached catalogue (e.g. after publishing) so the next load refetches it. */
export function invalidateCatalogue() {
  pending = null
}

// Assets an admin hid during this visit. The database is the source of truth
// (hidden rows are never fetched); this set just removes them from the
// already-loaded list immediately, without a refetch.
let hiddenIds = new Set()
const hiddenListeners = new Set()

export function setLocallyHidden(id, hidden) {
  const next = new Set(hiddenIds)
  if (hidden) next.add(id)
  else next.delete(id)
  hiddenIds = next
  hiddenListeners.forEach((listener) => listener())
}

function subscribeHidden(listener) {
  hiddenListeners.add(listener)
  return () => hiddenListeners.delete(listener)
}

/** { status: 'loading' | 'ready' | 'error', categories, assets, error, retry } */
export function useCatalogue() {
  const [state, setState] = useState({ status: 'loading', categories: [], assets: [], error: null })
  const [attempt, setAttempt] = useState(0)
  const hidden = useSyncExternalStore(subscribeHidden, () => hiddenIds)

  useEffect(() => {
    let cancelled = false
    loadCatalogue()
      .then(({ categories, assets }) => {
        if (!cancelled) setState({ status: 'ready', categories, assets, error: null })
      })
      .catch((error) => {
        console.error('[catalogue] Could not load the asset library from Supabase:', error)
        if (!cancelled) setState({ status: 'error', categories: [], assets: [], error })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState((current) => ({ ...current, status: 'loading' }))
    setAttempt((n) => n + 1)
  }, [])

  const assets = hidden.size ? state.assets.filter((asset) => !hidden.has(asset.id)) : state.assets
  return { ...state, assets, retry }
}
