import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'

/**
 * Mocked Login / Sign Up dialog. Nothing is sent or stored: submitting simply
 * reports a display name back to the app, and "Login as Admin" bypasses the
 * form entirely. Passwords are never read.
 */
const inputClass =
  'w-full rounded-md border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus:border-neutral-100'

const COPY = {
  login: { title: 'Welcome back', subtitle: 'Log in to download and manage your assets.', submit: 'Log in' },
  signup: { title: 'Create an account', subtitle: 'Join ArchiGrads to save and download assets.', submit: 'Sign up' },
}

function nameFromEmail(email) {
  const handle = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  return handle ? handle.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Student'
}

export default function AuthModal({ mode, onModeChange, onClose, onLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const firstFieldRef = useRef(null)
  const copy = COPY[mode]

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [mode])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const handleSubmit = (event) => {
    event.preventDefault()
    const displayName = mode === 'signup' && name.trim() ? name.trim() : nameFromEmail(email)
    onLogin({ name: displayName, isAdmin: false })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 shadow-2xl shadow-neutral-950/10 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-title" className="text-xl font-semibold tracking-tight">
              {copy.title}
            </h2>
            <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">{copy.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-md p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {mode === 'signup' && (
            <Field label="Full name" htmlFor="auth-name">
              <input
                ref={firstFieldRef}
                id="auth-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ada Lovelace"
                autoComplete="off"
                required
                className={inputClass}
              />
            </Field>
          )}
          <Field label="Email" htmlFor="auth-email">
            <input
              ref={mode === 'login' ? firstFieldRef : undefined}
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@university.edu"
              autoComplete="off"
              required
              className={inputClass}
            />
          </Field>
          <Field label="Password" htmlFor="auth-password">
            {/* Uncontrolled and never read: this is a demo form. */}
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              autoComplete="off"
              required
              className={inputClass}
            />
          </Field>

          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            {copy.submit}
          </button>
        </form>

        {mode === 'login' && (
          <>
            <div className="my-5 flex items-center gap-3 text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-400 dark:text-neutral-500">
              <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
              or
              <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            </div>
            <button
              type="button"
              onClick={() => onLogin({ name: 'Admin', isAdmin: true })}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 py-2.5 text-sm font-medium transition-colors hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-neutral-100"
            >
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              Login as Admin
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {mode === 'login' ? 'New to ArchiGrads? ' : 'Already have an account? '}
          <button
            type="button"
            onClick={() => onModeChange(mode === 'login' ? 'signup' : 'login')}
            className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100"
          >
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
        <p className="mt-4 text-center text-[11px] text-neutral-400 dark:text-neutral-500">
          Demo sign-in: no account is created and nothing is stored.
        </p>
      </div>
    </div>
  )
}

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {label}
      </label>
      {children}
    </div>
  )
}
