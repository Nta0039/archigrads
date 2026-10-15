import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import SiteHeader from './components/SiteHeader'
import AuthModal from './components/AuthModal'
import AssetsLibraryPage from './components/AssetsLibraryPage'
import AdminDashboard from './components/AdminDashboard'
import SuccessPage from './components/SuccessPage'
import AIGeneratorPage from './components/AIGeneratorPage'
import CookieBanner from './components/CookieBanner'
import LoadingScreen from './components/LoadingScreen'
import Footer from './components/Footer'
import AboutPage from './components/AboutPage'
import TermsPage from './components/TermsPage'
import PrivacyPage from './components/PrivacyPage'

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

/**
 * Path-based pages: "/" library, "/studio" AI Studio, "/success" Stripe return
 * page, plus the footer's "/about", "/terms" and "/privacy".
 */
const PAGE_PATHS = { library: '/', studio: '/studio', dashboard: '/', about: '/about', terms: '/terms', privacy: '/privacy' }
const pageFromPath = (path) =>
  ({ '/success': 'success', '/studio': 'studio', '/about': 'about', '/terms': 'terms', '/privacy': 'privacy' })[
    path.replace(/\/+$/, '')
  ] ?? 'library'
const initialPage = pageFromPath(window.location.pathname)
// Content pages get their own history entry, so the browser's Back button returns from them.
const HISTORY_PAGES = new Set(['about', 'terms', 'privacy'])

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
  const [studioPrompt, setStudioPrompt] = useState('') // carried over from a search with no results
  const [authMode, setAuthMode] = useState(null) // 'login' | 'signup' | null
  const [checkoutCancelled, setCheckoutCancelled] = useState(
    () => new URLSearchParams(window.location.search).get('checkout') === 'cancelled',
  )

  // Back / Forward between the library and the content pages.
  useEffect(() => {
    const onPopState = () => {
      setPage(pageFromPath(window.location.pathname))
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

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
    const path = PAGE_PATHS[next] ?? '/'
    if (window.location.pathname !== path) {
      if (HISTORY_PAGES.has(next)) window.history.pushState(null, '', path)
      else window.history.replaceState(null, '', path)
    }
    setPage(next === 'dashboard' && !isAdmin ? 'library' : next)
    window.scrollTo(0, 0)
  }

  const user = isLoggedIn ? { name: userName, isAdmin } : null
  const showDashboard = page === 'dashboard' && isAdmin

  const openStudio = (prompt = '') => {
    setStudioPrompt(prompt)
    navigate('studio')
  }
  // Header / footer links open AI Studio with an empty prompt.
  const navigateFresh = (next) => (next === 'studio' ? openStudio('') : navigate(next))

  let content = <AssetsLibraryPage isAdmin={isLoggedIn && isAdmin} onOpenStudio={openStudio} />
  if (page === 'success') content = <SuccessPage onBack={() => navigate('library')} />
  else if (page === 'studio') content = <AIGeneratorPage initialPrompt={studioPrompt} onBack={() => navigate('library')} />
  else if (showDashboard) content = <AdminDashboard onBack={() => navigate('library')} live={isPresentationMode} />
  else if (page === 'about') content = <AboutPage onBack={() => navigate('library')} />
  else if (page === 'terms') content = <TermsPage onBack={() => navigate('library')} />
  else if (page === 'privacy') content = <PrivacyPage onBack={() => navigate('library')} />

  return (
    <div className="flex min-h-screen flex-col text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white dark:text-neutral-100 dark:selection:bg-neutral-100 dark:selection:text-neutral-900">
      <SiteHeader
        user={user}
        page={showDashboard ? 'dashboard' : page === 'studio' || page === 'about' ? page : 'library'}
        onNavigate={navigateFresh}
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
              className="p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {/* flex-1 keeps the footer at the bottom of the window on short pages. */}
      <div className="flex flex-1 flex-col">{content}</div>

      <Footer onNavigate={navigateFresh} />

      {authMode && (
        <AuthModal mode={authMode} onModeChange={setAuthMode} onClose={closeAuth} onLogin={handleLogin} />
      )}

      {/* On every page until the visitor accepts or declines. */}
      <CookieBanner />

      {/* Animated logo splash on the first load of the site; fades out by itself. */}
      <LoadingScreen />
    </div>
  )
}
