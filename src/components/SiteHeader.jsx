import { LayoutDashboard, LogOut, Presentation, Sparkles } from 'lucide-react'
import { FLOWING_BORDER } from '../lib/flowingBorder'
import ThemeToggle from '../theme/ThemeToggle'

const quietButton =
  'whitespace-nowrap rounded-md px-2.5 py-2 text-sm text-neutral-600 sm:px-3 transition-colors hover:bg-neutral-200/60 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'

const solidButton =
  'whitespace-nowrap rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white sm:px-4 transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300'

/** Sticky site header: logo (+ admin link) on the left, account controls and theme toggle on the right. */
export default function SiteHeader({
  user,
  page,
  onNavigate,
  onOpenAuth,
  onLogout,
  isPresentationMode,
  onTogglePresentation,
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <button type="button" onClick={() => onNavigate('library')} aria-label="ArchiGrads home" className="flex shrink-0 items-center gap-2.5">
            {/* logo-mark.png is public/logo.png cropped to the cap. The mark is navy,
                so dark mode flattens it to black and inverts it to pure white. */}
            <img
              src="/logo-mark.png"
              alt=""
              width={835}
              height={512}
              draggable={false}
              className="h-7 w-auto sm:h-8 dark:brightness-0 dark:invert"
            />
            {/* Narrow phones show only the mark: the wordmark would collide with Login / Sign Up. */}
            <span className="hidden text-xl font-bold tracking-tight min-[480px]:inline md:text-2xl">ArchiGrads</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('studio')}
            aria-current={page === 'studio' ? 'page' : undefined}
            aria-label="AI Studio"
            // Same flowing light border as the "AI Generated" category pill; solid while on the page.
            // 36px tall, like Login / Sign Up (text-sm, py-2 + a 1px border, or py-[6px] + 2px here).
            className={`flex items-center gap-2 whitespace-nowrap rounded-md text-sm transition-[color,background-color,border-color,box-shadow] ${
              page === 'studio'
                ? 'border border-neutral-900 bg-neutral-900 px-3 py-[7px] font-medium text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                : `${FLOWING_BORDER} px-[11px] py-[6px]`
            }`}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {/* Admins have more header controls, so their labels wait for lg widths. */}
            <span className={user?.isAdmin ? 'hidden lg:inline' : 'hidden sm:inline'}>AI Studio</span>
          </button>

          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              aria-current={page === 'dashboard' ? 'page' : undefined}
              aria-label="Dashboard"
              title="Dashboard"
              className={`hidden items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors sm:flex ${
                page === 'dashboard'
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'border-neutral-300 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-100 dark:hover:text-neutral-100'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              <span className="hidden lg:inline">Dashboard</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {user.isAdmin && (
                <button
                  type="button"
                  onClick={onTogglePresentation}
                  aria-pressed={isPresentationMode}
                  title="Fill the dashboard with sample data"
                  className={`mr-1 flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isPresentationMode
                      ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                      : 'border-neutral-300 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-100 dark:hover:text-neutral-100'
                  }`}
                >
                  <Presentation className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                  <span className="hidden lg:inline">Presentation Mode</span>
                  {/* Status light: off = hollow, on = filled. */}
                  <span
                    aria-hidden
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      isPresentationMode
                        ? 'bg-white dark:bg-neutral-900'
                        : 'border border-neutral-400 dark:border-neutral-500'
                    }`}
                  />
                </button>
              )}
              <div className="flex items-center gap-2.5 pr-1">
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-200 text-xs font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[10rem] truncate text-sm lg:block">{user.name}</span>
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
