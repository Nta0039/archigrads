import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import SiteHeader from './components/SiteHeader'
import AuthModal from './components/AuthModal'
import AssetsLibraryPage from './components/AssetsLibraryPage'
import AdminDashboard from './components/AdminDashboard'
import SuccessPage from './components/SuccessPage'

/**
 * useState that survives a reload of this tab. Used for the mocked login so the
 * round trip through Stripe Checkout does not sign the admin out mid-demo.
 * sessionStorage is per tab and cleared when the tab closes.
 */
function useSessionState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = sessionStorage.getItem(key)
      return stored === null ? initial : JSON.parse(stored)
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage blocked: the value just won't survive a reload.
    }
  }, [key, value])
  return [value, setValue]
}

/** Path-based pages: "/" is the library, "/success" is the Stripe return page. */
const initialPage = window.location.pathname === '/success' ? 'success' : 'library'

/**
 * App shell. Auth is mocked for the assignment (no backend accounts): the demo
 * login is kept in sessionStorage so it survives the Stripe redirect.
 */
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useSessionState('archigrads-demo-logged-in', false)
  const [isAdmin, setIsAdmin] = useSessionState('archigrads-demo-admin', false)
  const [userName, setUserName] = useSessionState('archigrads-demo-name', '')
  const [isPresentationMode, setIsPresentationMode] = useSessionState('archigrads-demo-presentation', false)
  const [page, setPage] = useState(initialPage)
  const [authMode, setAuthMode] = useState(null) // 'login' | 'signup' | null
  const [checkoutCancelled, setCheckoutCancelled] = useState(
    () => new URLSearchParams(window.location.search).get('checkout') === 'cancelled',
  )

  // Tidy the address bar after reading the cancelled flag.
  useEffect(() => {
    if (checkoutCancelled) window.history.replaceState(null, '', '/')
  }, [checkoutCancelled])

  const closeAuth = useCallback(() => setAuthMode(null), [])

  const handleLogin = ({ name, isAdmin: admin }) => {
    setIsLoggedIn(true)
    setIsAdmin(admin)
    setUserName(name)
    setAuthMode(null)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    setIsAdmin(false)
    setUserName('')
    setIsPresentationMode(false)
    navigate('library')
  }

  const navigate = (next) => {
    if (window.location.pathname !== '/') window.history.replaceState(null, '', '/')
    setPage(next === 'dashboard' && !isAdmin ? 'library' : next)
    window.scrollTo(0, 0)
  }

  const user = isLoggedIn ? { name: userName, isAdmin } : null
  const showDashboard = page === 'dashboard' && isAdmin

  let content = <AssetsLibraryPage />
  if (page === 'success') content = <SuccessPage onBack={() => navigate('library')} />
  else if (showDashboard) content = <AdminDashboard onBack={() => navigate('library')} live={isPresentationMode} />

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-neutral-100 dark:selection:text-neutral-900">
      <SiteHeader
        user={user}
        page={showDashboard ? 'dashboard' : 'library'}
        onNavigate={navigate}
        onOpenAuth={setAuthMode}
        onLogout={handleLogout}
        isPresentationMode={isPresentationMode}
        onTogglePresentation={() => setIsPresentationMode((on) => !on)}
      />

      {checkoutCancelled && page === 'library' && (
        <div className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3 text-sm lg:px-8">
            <p className="text-neutral-600 dark:text-neutral-300">Checkout cancelled. You have not been charged.</p>
            <button
              type="button"
              onClick={() => setCheckoutCancelled(false)}
              aria-label="Dismiss"
              className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {content}

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-6 py-10 text-sm text-neutral-400 sm:flex-row sm:items-center lg:px-8 dark:text-neutral-500">
          <p>© {new Date().getFullYear()} ArchiGrads. All rights reserved.</p>
          <p className="text-xs uppercase tracking-[0.2em]">Built for architecture students</p>
        </div>
      </footer>

      {authMode && (
        <AuthModal mode={authMode} onModeChange={setAuthMode} onClose={closeAuth} onLogin={handleLogin} />
      )}
    </div>
  )
}
