import { useCallback, useEffect, useState } from 'react'
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

/** { status: 'loading' | 'ready' | 'error', categories, assets, error, retry } */
export function useCatalogue() {
  const [state, setState] = useState({ status: 'loading', categories: [], assets: [], error: null })
  const [attempt, setAttempt] = useState(0)

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

  return { ...state, retry }
}
