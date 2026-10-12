import { useSyncExternalStore } from 'react'
import { nextSaleChange } from './pricing'

/*
 * Two tiny shared clocks for flash sales, so timing work never re-renders the
 * whole grid:
 *
 * - a one-second clock, running only while a countdown is on screen. Every
 *   countdown reads the same value, so all timers in the app tick in sync;
 * - a "sale epoch" that changes only when a sale starts or ends (Monday and
 *   Saturday 00:00 Sydney time). Sorting, badges and prices read it.
 */

// --- one-second clock -------------------------------------------------------
const second = () => Math.floor(Date.now() / 1000) * 1000
let now = second()
let tickTimer = null
const tickListeners = new Set()

function tick() {
  // Align to the start of each second so the display never skips a number.
  tickTimer = setTimeout(() => {
    now = second()
    tickListeners.forEach((listener) => listener())
    if (tickListeners.size) tick()
    else tickTimer = null
  }, 1000 - (Date.now() % 1000) + 5)
}

function subscribeTick(listener) {
  tickListeners.add(listener)
  if (!tickTimer) {
    now = second()
    tick()
  }
  return () => {
    tickListeners.delete(listener)
    if (!tickListeners.size && tickTimer) {
      clearTimeout(tickTimer)
      tickTimer = null
    }
  }
}

// While idle the clock is frozen, so refresh it (to the whole second) on read.
const readTick = () => (tickTimer ? now : (now = second()))

/** { remaining, days, hours, minutes, seconds, label } until endsAt, shared and synced app-wide. */
export function useFlashSaleCountdown(endsAt) {
  const current = useSyncExternalStore(subscribeTick, readTick)
  const remaining = Math.max(0, endsAt - current)
  const total = Math.floor(remaining / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value) => String(value).padStart(2, '0')
  return { remaining, days, hours, minutes, seconds, label: `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s` }
}

// --- sale epoch -------------------------------------------------------------
let epoch = 0
let epochTimer = null
const epochListeners = new Set()

function bumpEpoch() {
  epoch += 1
  epochListeners.forEach((listener) => listener())
}

function scheduleEpoch() {
  const next = nextSaleChange()
  if (next == null) return
  epochTimer = setTimeout(() => {
    bumpEpoch()
    scheduleEpoch()
  }, Math.min(Math.max(0, next - Date.now()) + 50, 2 ** 31 - 1))
}

// Timers can fire late after sleep or in a background tab; re-check on return.
const onVisible = () => {
  if (document.visibilityState === 'visible') bumpEpoch()
}

function subscribeEpoch(listener) {
  epochListeners.add(listener)
  if (!epochTimer) {
    scheduleEpoch()
    document.addEventListener('visibilitychange', onVisible)
  }
  return () => {
    epochListeners.delete(listener)
    if (!epochListeners.size && epochTimer) {
      clearTimeout(epochTimer)
      epochTimer = null
      document.removeEventListener('visibilitychange', onVisible)
    }
  }
}

/** A number that changes whenever a flash sale starts or ends; use it to recompute sale state. */
export function useSaleEpoch() {
  return useSyncExternalStore(subscribeEpoch, () => epoch)
}
