import { createContext, useContext, useEffect, useState } from 'react'

/**
 * Light / dark theme.
 *
 * Follows the operating system setting until the visitor presses the toggle;
 * from then on their choice is remembered in localStorage. The `dark` class on
 * <html> drives Tailwind's `dark:` variants (see index.css). index.html applies
 * the same logic before React loads so the page never flashes the wrong theme.
 */
const STORAGE_KEY = 'archigrads-theme'
const systemQuery = window.matchMedia('(prefers-color-scheme: dark)')

function readStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [storedTheme, setStoredTheme] = useState(readStoredTheme)
  const [systemTheme, setSystemTheme] = useState(systemQuery.matches ? 'dark' : 'light')
  const theme = storedTheme ?? systemTheme

  // Track OS changes; only visible while the visitor has not chosen manually.
  useEffect(() => {
    const onChange = (event) => setSystemTheme(event.matches ? 'dark' : 'light')
    systemQuery.addEventListener('change', onChange)
    return () => systemQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setStoredTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can be blocked (private mode); the toggle still works for this visit.
    }
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
