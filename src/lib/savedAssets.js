import { useCallback, useSyncExternalStore } from 'react'

/**
 * "Save to Library": a per-browser bookmark list (asset slugs in localStorage).
 * The library shows a "Saved" filter once anything is saved. Storage can be
 * blocked (private windows), so every read and write is guarded; saving then
 * still works for the current visit.
 */
const KEY = 'archigrads-saved-assets'
const listeners = new Set()

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

let saved = new Set(read())

function write(next) {
  saved = next
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]))
  } catch {
    // Not persisted (storage unavailable); kept in memory for this visit.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** { saved: Set<slug>, toggle(slug) } */
export function useSavedAssets() {
  const current = useSyncExternalStore(subscribe, () => saved)
  const toggle = useCallback((id) => {
    const next = new Set(saved)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    write(next)
  }, [])
  return { saved: current, toggle }
}
