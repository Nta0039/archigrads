import { ArrowLeft } from 'lucide-react'

/** Shared layout for the About, Terms and Privacy pages: one centred column of text. */
export default function InfoPage({ eyebrow, title, updated, onBack, children }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-24">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Back to library
      </button>
      <p className="mt-12 text-[11px] font-semibold uppercase tracking-[0.35em] text-neutral-400 dark:text-neutral-500">
        {eyebrow}
      </p>
      <h1 className="mt-4 border-b-2 border-neutral-950 pb-6 text-4xl font-bold tracking-tight sm:text-5xl dark:border-white">
        {title}
      </h1>
      {updated && (
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">Last updated {updated}</p>
      )}
      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-neutral-700 dark:text-neutral-300 [&_h2]:mt-12 [&_h2]:border-t [&_h2]:border-neutral-300 [&_h2]:pt-6 [&_h2]:text-xs [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-[0.25em] [&_h2]:text-neutral-950 dark:[&_h2]:border-neutral-700 dark:[&_h2]:text-white [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-neutral-950 dark:[&_strong]:text-white [&_ul]:list-[square] [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  )
}
