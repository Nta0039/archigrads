import { useCallback, useState } from 'react'
import SiteHeader from './components/SiteHeader'
import AuthModal from './components/AuthModal'
import AssetsLibraryPage from './components/AssetsLibraryPage'
import AdminDashboard from './components/AdminDashboard'

/**
 * App shell. Auth is mocked with plain React state for the assignment: there is
 * no backend session, so a page refresh signs the visitor out again.
 */
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userName, setUserName] = useState('')
  const [page, setPage] = useState('library')
  const [authMode, setAuthMode] = useState(null) // 'login' | 'signup' | null

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
    setPage('library')
  }

  const navigate = (next) => {
    setPage(next === 'dashboard' && !isAdmin ? 'library' : next)
    window.scrollTo(0, 0)
  }

  const user = isLoggedIn ? { name: userName, isAdmin } : null
  const showDashboard = page === 'dashboard' && isAdmin

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-neutral-100 dark:selection:text-neutral-900">
      <SiteHeader
        user={user}
        page={showDashboard ? 'dashboard' : 'library'}
        onNavigate={navigate}
        onOpenAuth={setAuthMode}
        onLogout={handleLogout}
      />

      {showDashboard ? <AdminDashboard onBack={() => navigate('library')} /> : <AssetsLibraryPage />}

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
