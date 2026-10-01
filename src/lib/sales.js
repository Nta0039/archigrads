import { useSyncExternalStore } from 'react'

/**
 * Completed Stripe test-mode sales, kept in this browser's localStorage so the
 * admin dashboard can show a purchase made during the presentation. There is no
 * database: sales live only in the browser that completed the checkout.
 *
 * The success page records a sale only after /api/session confirms it was paid,
 * and each Checkout Session id is stored once, so reloads do not double count.
 */
const STORAGE_KEY = 'archigrads-sales'
const listeners = new Set()
const EMPTY = []
let cachedRaw = null
let cachedSales = EMPTY

function read() {
  let raw = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    // Storage blocked (private mode): behave as if there are no sales.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      const parsed = JSON.parse(raw ?? '[]')
      cachedSales = Array.isArray(parsed) ? parsed : EMPTY
    } catch {
      cachedSales = EMPTY
    }
  }
  return cachedSales
}

function notify() {
  listeners.forEach((listener) => listener())
}

/** Adds a confirmed sale; returns false if this session was already recorded. */
export function recordSale(sale) {
  const sales = read()
  if (sales.some((existing) => existing.sessionId === sale.sessionId)) return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...sale, at: Date.now() }, ...sales]))
  } catch {
    return false
  }
  notify()
  return true
}

export function clearSales() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored to clear.
  }
  notify()
}

function subscribe(listener) {
  listeners.add(listener)
  // Another tab (e.g. the success page) changed the sales: update this one too.
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY || event.key === null) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Live list of recorded sales, newest first. */
export function useSales() {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}
