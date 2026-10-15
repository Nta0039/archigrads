import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * Light / dark theme.
 *
 * Follows the visitor's clock until they press the toggle: dark from 18:00 to
 * 06:00 local time, light otherwise (switching on the hour while the page is
 * open). Once they press the toggle, their choice is remembered in localStorage. The `dark` class on
 * <html> drives Tailwind's `dark:` variants (see index.css). index.html applies
 * the same logic before React loads so the page never flashes the wrong theme.
 */
const STORAGE_KEY = 'archigrads-theme'
const FADE_MS = 300
const DARK_FROM_HOUR = 18
const LIGHT_FROM_HOUR = 6

/** 'dark' from 18:00 to 06:00 on the visitor's own clock, 'light' otherwise. */
function clockTheme(date = new Date()) {
  const hour = date.getHours()
  return hour >= DARK_FROM_HOUR || hour < LIGHT_FROM_HOUR ? 'dark' : 'light'
}

/** Milliseconds until the next 06:00 or 18:00 local time. */
function msUntilNextSwitch(date = new Date()) {
  const next = new Date(date)
  next.setMinutes(0, 0, 0)
  const hour = date.getHours()
  if (hour < LIGHT_FROM_HOUR) {
    next.setHours(LIGHT_FROM_HOUR)
  } else if (hour < DARK_FROM_HOUR) {
    next.setHours(DARK_FROM_HOUR)
  } else {
    next.setDate(next.getDate() + 1)
    next.setHours(LIGHT_FROM_HOUR)
  }
  return next - date
}
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function applyThemeClass(theme) {
  // A single class write and no layout reads, so the swap never forces a reflow.
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

/**
 * Swaps the theme with one synchronized fade. Where supported, the View
 * Transitions API crossfades a snapshot of the old page into the new one on the
 * compositor, so no element repaints mid-animation. Other browsers get a
 * temporary `.theme-fading` class that gives every element the same 300ms colour
 * transition (see index.css), instead of a mix of fading and snapping elements.
 */
function withThemeFade(update) {
  // Nothing to animate in a background tab (e.g. the clock reaches 18:00 unseen).
  if (reducedMotionQuery.matches || document.visibilityState === 'hidden') {
    update()
    return
  }

  if (document.startViewTransition) {
    // The browser may still skip the animation (the theme is applied anyway) and
    // rejects `ready` when it does; that is expected, so don't report it.
    document.startViewTransition(update).ready.catch(() => {})
    return
  }

  const root = document.documentElement
  root.classList.add('theme-fading')
  update()
  window.setTimeout(() => root.classList.remove('theme-fading'), FADE_MS)
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [storedTheme, setStoredTheme] = useState(readStoredTheme)
  const [timeTheme, setTimeTheme] = useState(clockTheme)
  const theme = storedTheme ?? timeTheme

  // Switch at 06:00 / 18:00 while the page is open; also re-check when the tab
  // comes back (timers can fire late after sleep). Only visible while the
  // visitor has not chosen a theme with the toggle.
  useEffect(() => {
    let timer
    const sync = () => {
      const next = clockTheme()
      const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
      // Fade only when the page actually changes theme (not if the toggle has fixed it).
      if (next !== current && !readStoredTheme()) withThemeFade(() => flushSync(() => setTimeTheme(next)))
      else setTimeTheme(next)
    }
    const schedule = () => {
      timer = setTimeout(() => {
        sync()
        schedule()
      }, msUntilNextSwitch() + 1000)
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    schedule()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Layout effect so the class lands in the same frame as the React commit.
  useLayoutEffect(() => applyThemeClass(theme), [theme])

  const value = useMemo(() => {
    const toggleTheme = () => {
      // The fade runs the update a frame later, so decide the next theme inside
      // it from the live <html> class; rapid clicks then always alternate.
      withThemeFade(() => {
        const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark'
        try {
          localStorage.setItem(STORAGE_KEY, next)
        } catch {
          // Storage can be blocked (private mode); the toggle still works for this visit.
        }
        // flushSync commits the new state (and its layout effect) inside the
        // transition callback, so the "after" snapshot shows the new theme.
        flushSync(() => setStoredTheme(next))
      })
    }
    return { theme, toggleTheme }
  }, [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
