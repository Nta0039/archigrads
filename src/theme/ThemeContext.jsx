import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * Light / dark theme.
 *
 * Follows the operating system setting until the visitor presses the toggle;
 * from then on their choice is remembered in localStorage. The `dark` class on
 * <html> drives Tailwind's `dark:` variants (see index.css). index.html applies
 * the same logic before React loads so the page never flashes the wrong theme.
 */
const STORAGE_KEY = 'archigrads-theme'
const FADE_MS = 300
const systemQuery = window.matchMedia('(prefers-color-scheme: dark)')
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
  if (reducedMotionQuery.matches) {
    update()
    return
  }

  if (document.startViewTransition) {
    document.startViewTransition(update)
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
  const [systemTheme, setSystemTheme] = useState(systemQuery.matches ? 'dark' : 'light')
  const theme = storedTheme ?? systemTheme

  // Track OS changes; only visible while the visitor has not chosen manually.
  useEffect(() => {
    const onChange = (event) => {
      const next = event.matches ? 'dark' : 'light'
      withThemeFade(() => {
        flushSync(() => setSystemTheme(next))
      })
    }
    systemQuery.addEventListener('change', onChange)
    return () => systemQuery.removeEventListener('change', onChange)
  }, [])

  // Layout effect so the class lands in the same frame as the React commit.
  useLayoutEffect(() => applyThemeClass(theme), [theme])

  const value = useMemo(() => {
    const toggleTheme = () => {
      const next = theme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Storage can be blocked (private mode); the toggle still works for this visit.
      }
      // flushSync commits the new state (and its layout effect) inside the
      // transition callback, so the "after" snapshot shows the new theme.
      withThemeFade(() => {
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
