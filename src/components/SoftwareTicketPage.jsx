import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const SOFTWARE_OPTIONS = [
  'AutoCAD',
  'Revit',
  'Rhino',
  'SketchUp',
  'Adobe CC',
  'V-Ray',
  'Enscape',
  'Other',
]

const OS_OPTIONS = ['Windows 11', 'Windows 10', 'macOS (Apple Silicon)', 'macOS (Intel)']

const LABEL = 'mb-2 block text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500'
const FIELD =
  'w-full border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-neutral-900'

/**
 * Software Assistance intake form. Submits a row to the Supabase
 * `software_tickets` table: { name, contact, software, os, description }.
 */
export default function SoftwareTicketPage({ onBack }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return

    const form = event.currentTarget
    const data = new FormData(form)
    const payload = {
      name: String(data.get('name') || '').trim(),
      contact: String(data.get('contact') || '').trim(),
      software: String(data.get('software') || ''),
      os: String(data.get('os') || ''),
      description: String(data.get('description') || '').trim(),
    }

    if (!isSupabaseConfigured || !supabase) {
      setStatus({
        type: 'error',
        message: 'The backend is not configured. Add your Supabase keys to the .env file.',
      })
      return
    }

    setIsSubmitting(true)
    setStatus(null)

    try {
      const { error } = await supabase.from('software_tickets').insert(payload)
      if (error) throw error

      setStatus({ type: 'success', message: 'Request submitted. Our team will contact you shortly.' })
      form.reset()
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.message || 'Something went wrong. Please try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Back to Home
        </button>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-24 lg:px-8">
        <header className="max-w-2xl border-t border-neutral-200 pt-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-400">
            Software Assistance
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Submit a support request
          </h1>
          <p className="mt-5 leading-relaxed text-neutral-500">
            Tell us what you are working with and what is getting in the way. We will get back to you
            with the fastest fix, remote assistance, or a setup walkthrough.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-12 max-w-2xl space-y-8">
          <div>
            <label className={LABEL} htmlFor="ticket-name">
              Name
            </label>
            <input
              id="ticket-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              placeholder="Your full name"
              className={FIELD}
            />
          </div>

          <div>
            <label className={LABEL} htmlFor="ticket-contact">
              Contact Email / WeChat
            </label>
            <input
              id="ticket-contact"
              name="contact"
              type="text"
              required
              placeholder="you@university.edu.au or WeChat ID"
              className={FIELD}
            />
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="ticket-software">
                Software Needed
              </label>
              <select id="ticket-software" name="software" required defaultValue="" className={FIELD}>
                <option value="" disabled>
                  Select software…
                </option>
                {SOFTWARE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={LABEL} htmlFor="ticket-os">
                Operating System
              </label>
              <select id="ticket-os" name="os" required defaultValue="" className={FIELD}>
                <option value="" disabled>
                  Select operating system…
                </option>
                {OS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="ticket-description">
              Problem Description
            </label>
            <textarea
              id="ticket-description"
              name="description"
              rows={4}
              placeholder="Describe the issue, error messages, and anything you have already tried."
              className={`${FIELD} resize-y`}
            />
          </div>

          {status && (
            <p
              role="status"
              className={`border px-4 py-3 text-sm ${
                status.type === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-red-300 bg-red-50 text-red-700'
              }`}
            >
              {status.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center bg-neutral-900 px-8 py-4 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </main>
    </div>
  )
}
