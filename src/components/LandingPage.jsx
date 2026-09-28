import { ArrowUpRight, Box, Monitor, PenTool } from 'lucide-react'

const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'Contact', href: '#contact' },
]

const SERVICES = [
  {
    icon: Monitor,
    title: 'Software Assistance',
    action: 'software',
    description:
      'Remote assistance to help you install, configure, and troubleshoot heavy architectural software flawlessly.',
  },
  {
    icon: Box,
    title: 'White Model Rendering',
    action: 'render',
    description:
      'Cloud-based 3D white model rendering. Send us your models, and we deliver crisp, professional base renders for your diagrams.',
  },
  {
    icon: PenTool,
    title: 'Vector Assets Library',
    action: 'assets',
    description:
      'A curated collection of high-quality architectural vector materials, CAD blocks, and cutouts for your sections and elevations.',
  },
]

/**
 * ArchiGrads marketing landing page. Monochrome, editorial and architectural:
 * hairline rules, generous whitespace, and large type. No 3D, no canvas.
 */
export default function LandingPage({ onNavigate }) {
  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-neutral-900 selection:text-white">
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center border border-neutral-900">
              <span className="h-2 w-2 bg-neutral-900" />
            </span>
            <span className="text-base font-semibold tracking-tight">ArchiGrads</span>
          </a>

          <nav className="flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 sm:pt-32 lg:px-8 lg:pb-28 lg:pt-40">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-400">
            For architecture students
          </p>

          <h1 className="mt-8 max-w-4xl text-5xl font-bold leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
            Focus on Design.
            <br />
            <span className="text-neutral-400">We Handle the Rest.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-neutral-500 sm:text-xl">
            The ultimate utility hub for architecture students—software support, fast rendering, and
            premium assets.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#services"
              className="inline-flex items-center gap-2 bg-neutral-900 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
            >
              Explore Services
            </a>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 border border-neutral-300 px-7 py-3.5 text-sm font-medium text-neutral-900 transition-colors hover:border-neutral-900"
            >
              Talk to us
            </a>
          </div>
        </section>

        {/* Core features */}
        <section id="services" className="border-t border-neutral-200">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:px-8 lg:py-28">
            <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
              <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Everything you need, so nothing slows you down.
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-neutral-500">
                Three focused services built around the way architecture students actually work.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden border border-neutral-200 bg-neutral-200 md:grid-cols-3">
              {SERVICES.map((service) => (
                <ServiceCard
                  key={service.title}
                  icon={service.icon}
                  title={service.title}
                  onClick={service.action ? () => onNavigate?.(service.action) : undefined}
                >
                  {service.description}
                </ServiceCard>
              ))}
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section id="contact" className="border-t border-neutral-200 bg-neutral-50">
          <div className="mx-auto max-w-6xl px-6 py-20 lg:px-8 lg:py-24">
            <h2 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Ready to spend more time designing?
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-neutral-500">
              Tell us what you are working on and we will point you to the fastest path forward.
            </p>
            <a
              href="mailto:hello@archigrads.com"
              className="mt-8 inline-flex items-center gap-2 bg-neutral-900 px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
            >
              hello@archigrads.com
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.75} />
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-10 text-sm text-neutral-400 sm:flex-row sm:items-center lg:px-8">
          <p>© {new Date().getFullYear()} ArchiGrads. All rights reserved.</p>
          <p className="text-xs uppercase tracking-[0.2em]">Built for architecture students</p>
        </div>
      </footer>
    </div>
  )
}

function ServiceCard({ icon: Icon, title, children, onClick }) {
  const content = (
    <>
      <span className="flex h-11 w-11 items-center justify-center border border-neutral-300 text-neutral-900 transition-colors group-hover:border-neutral-900">
        <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
      </span>
      <h3 className="mt-7 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-neutral-500">{children}</p>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative bg-white p-8 text-left transition-colors hover:bg-neutral-50 sm:p-10"
      >
        <ArrowUpRight
          className="absolute right-8 top-8 h-4 w-4 text-neutral-300 transition-colors group-hover:text-neutral-900 sm:right-10 sm:top-10"
          strokeWidth={1.75}
          aria-hidden
        />
        {content}
      </button>
    )
  }

  return (
    <article className="group bg-white p-8 transition-colors hover:bg-neutral-50 sm:p-10">
      {content}
    </article>
  )
}
