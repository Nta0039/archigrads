import { LayoutDashboard, LogOut } from 'lucide-react'
import ThemeToggle from '../theme/ThemeToggle'

const quietButton =
  'rounded-md px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-200/60 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'

const solidButton =
  'rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300'

/** Sticky site header: logo (+ admin link) on the left, account controls and theme toggle on the right. */
export default function SiteHeader({ user, page, onNavigate, onOpenAuth, onLogout }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <button type="button" onClick={() => onNavigate('library')} className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-900 dark:border-neutral-100">
              <span className="h-2 w-2 rounded-[2px] bg-neutral-900 dark:bg-neutral-100" />
            </span>
            <span className="text-base font-semibold tracking-tight">ArchiGrads</span>
          </button>

          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              aria-current={page === 'dashboard' ? 'page' : undefined}
              className={`hidden items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors sm:flex ${
                page === 'dashboard'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-300 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-100 dark:hover:text-neutral-100'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Dashboard
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="flex items-center gap-2.5 pr-1">
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-200 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[10rem] truncate text-sm sm:block">{user.name}</span>
              </div>
              <button type="button" onClick={onLogout} className={`${quietButton} flex items-center gap-2`}>
                <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => onOpenAuth('login')} className={quietButton}>
                Login
              </button>
              <button type="button" onClick={() => onOpenAuth('signup')} className={solidButton}>
                Sign Up
              </button>
            </>
          )}
          <span className="mx-1 hidden h-6 w-px bg-neutral-200 sm:block dark:bg-neutral-800" aria-hidden />
          <ThemeToggle />
        </div>
      </div>

      {/* Phone widths: the admin link moves to its own strip under the header. */}
      {user?.isAdmin && (
        <div className="border-t border-neutral-200 px-6 py-2 sm:hidden dark:border-neutral-800">
          <button
            type="button"
            onClick={() => onNavigate(page === 'dashboard' ? 'library' : 'dashboard')}
            className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-400"
          >
            <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            {page === 'dashboard' ? 'Back to library' : 'Dashboard'}
          </button>
        </div>
      )}
    </header>
  )
}
