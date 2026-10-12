import { ArrowUpRight } from 'lucide-react'

export const CONTACT_URL = 'https://www.instagram.com/archi_grads/'

const LINK =
  'text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-600 transition-colors hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white'

/**
 * Site-wide footer. The internal links are real hrefs (so they can be opened in
 * a new tab or shared) but navigate inside the app on a normal click.
 */
export default function Footer({ onNavigate }) {
  const internal = (page, path, label) => (
    <a
      href={path}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
        event.preventDefault()
        onNavigate(page)
      }}
      className={LINK}
    >
      {label}
    </a>
  )

  // Same surface as the site header (bg + blur + border), so header and footer bookend the page.
  return (
    <footer className="border-t border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 py-10 md:flex-row md:items-center md:justify-between lg:px-8">
        <nav aria-label="Footer" className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
          <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className={`${LINK} inline-flex items-center gap-1.5`}>
            Contact us
            <ArrowUpRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          </a>
          {internal('about', '/about', 'About us')}
          {internal('terms', '/terms', 'Terms & Conditions')}
          {internal('privacy', '/privacy', 'Privacy Policy')}
        </nav>
        <div className="text-[11px] uppercase tracking-[0.25em] text-neutral-400 md:text-right dark:text-neutral-500">
          <p className="font-semibold text-neutral-950 dark:text-white">Spend Less. Choose More. Design Better.</p>
          <p className="mt-1.5">© {new Date().getFullYear()} ArchiGrads</p>
        </div>
      </div>
    </footer>
  )
}
