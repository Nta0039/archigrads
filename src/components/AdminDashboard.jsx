import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  DollarSign,
  Eye,
  Inbox,
  Layers,
  RotateCcw,
  ShoppingBag,
  UserPlus,
  Users,
} from 'lucide-react'
import { clearSales, useSales } from '../lib/sales'

/**
 * Admin analytics view. There is no analytics backend yet, so by default the
 * dashboard shows the honest empty state (zeros, no activity). The admin-only
 * Presentation Mode toggle (`live`) fills it with the sample data below.
 *
 * Real Stripe test-mode purchases (recorded by the success page in
 * localStorage) are always added on top, in both modes, and update live — even
 * from another tab — so a checkout during the presentation shows up here.
 */
const SAMPLE = { sold: 126, revenue: 1840 }

// Last 14 days, oldest first; the final entry is today.
const DAYS = ['Sep 18', 'Sep 19', 'Sep 20', 'Sep 21', 'Sep 22', 'Sep 23', 'Sep 24', 'Sep 25', 'Sep 26', 'Sep 27', 'Sep 28', 'Sep 29', 'Sep 30', 'Oct 1']
const PAGE_VIEWS = [812, 904, 768, 655, 980, 1032, 1104, 990, 1060, 874, 790, 1121, 1151, 1245]
const REVENUE = [90, 120, 60, 40, 150, 170, 130, 110, 160, 90, 70, 180, 200, 140]

const ACTIVITY = [
  { icon: ShoppingBag, text: 'Premium purchase · Door Families', who: 'student.042@example.edu', time: '4 min ago' },
  { icon: ArrowDownToLine, text: 'Downloaded · Walking Figure', who: 'student.117@example.edu', time: '12 min ago' },
  { icon: UserPlus, text: 'New sign-up', who: 'student.203@example.edu', time: '27 min ago' },
  { icon: ArrowDownToLine, text: 'Downloaded · Car', who: 'student.088@example.edu', time: '41 min ago' },
  { icon: ShoppingBag, text: 'Premium purchase · NCC Volume One Compliance Pack', who: 'student.156@example.edu', time: '1 hr ago' },
  { icon: UserPlus, text: 'New sign-up', who: 'student.231@example.edu', time: '2 hr ago' },
]

const TOP_ASSETS = [
  { title: 'Walking Figure', category: 'People', downloads: 412 },
  { title: 'Shrub Cluster', category: 'Vegetation', downloads: 356 },
  { title: 'Tree Section', category: 'Vegetation', downloads: 298 },
  { title: 'Furniture Set', category: 'Furniture', downloads: 241 },
  { title: 'Car', category: 'Vehicles', downloads: 187 },
]

const card = 'rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const formatNumber = (value) => value.toLocaleString('en-US')
const formatAud = (value) => `A$${value.toLocaleString('en-US')}`

function isToday(timestamp) {
  return new Date(timestamp).toDateString() === new Date().toDateString()
}

function timeAgo(timestamp) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} hr ago` : new Date(timestamp).toLocaleDateString('en-AU')
}

/** Counts up to `target` (ease-out, ~0.8s); drops straight to lower values. */
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(target)
  const valueRef = useRef(target)

  useEffect(() => {
    const from = valueRef.current
    if (target <= from || reducedMotion.matches) {
      valueRef.current = target
      setValue(target)
      return undefined
    }

    let frame
    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      valueRef.current = Math.round(from + (target - from) * eased)
      setValue(valueRef.current)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    // Animation frames pause in background tabs; make sure the final number
    // still lands on time.
    const settle = setTimeout(() => {
      cancelAnimationFrame(frame)
      valueRef.current = target
      setValue(target)
    }, duration + 100)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settle)
    }
  }, [target, duration])

  return value
}

export default function AdminDashboard({ onBack, live }) {
  const sales = useSales()
  const salesRevenue = sales.reduce((total, sale) => total + (Number(sale.amount) || 0), 0)
  const todaysSalesRevenue = sales.filter((sale) => isToday(sale.at)).reduce((t, s) => t + (Number(s.amount) || 0), 0)
  const salesNote = sales.length
    ? { change: `+${sales.length}`, note: 'via Stripe test checkout' }
    : null

  const metrics = [
    { label: "Today's Page Views", value: live ? 1245 : 0, change: '+8.2%', note: 'vs. yesterday', icon: Eye },
    { label: 'Weekly Active Users', value: live ? 843 : 0, change: '+3.1%', note: 'vs. last week', icon: Users },
    { label: 'Total Premium Assets', value: live ? 42 : 0, change: '+4', note: 'added this month', icon: Layers },
    { label: 'Downloads This Week', value: live ? 318 : 0, change: '−2.4%', note: 'vs. last week', icon: ArrowDownToLine },
    {
      label: 'Premium Assets Sold',
      value: (live ? SAMPLE.sold : 0) + sales.length,
      ...(salesNote ?? { change: '+12', note: 'this week' }),
      hasData: live || sales.length > 0,
      icon: ShoppingBag,
    },
    {
      label: 'Total Revenue',
      value: (live ? SAMPLE.revenue : 0) + salesRevenue,
      format: formatAud,
      ...(sales.length ? { change: `+${formatAud(salesRevenue)}`, note: 'via Stripe test checkout' } : { change: '+A$220', note: 'this week' }),
      hasData: live || sales.length > 0,
      icon: DollarSign,
    },
  ]

  const revenueSeries = REVENUE.map((value, index) =>
    index === REVENUE.length - 1 ? (live ? value : 0) + todaysSalesRevenue : live ? value : 0,
  )

  return (
    <main className="mx-auto max-w-7xl px-6 pb-24 pt-10 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        Back to library
      </button>

      <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-neutral-400 dark:text-neutral-500">
            Admin
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sales.length > 0 && (
            <>
              <span className="rounded border border-neutral-900 bg-neutral-900 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900">
                {sales.length} Stripe test {sales.length === 1 ? 'sale' : 'sales'}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear the recorded Stripe test sales from this browser?')) clearSales()
                }}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                <RotateCcw className="h-3 w-3" strokeWidth={2} aria-hidden />
                Reset
              </button>
            </>
          )}
          <span className="w-fit rounded border border-neutral-300 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            {live ? 'Sample data' : 'No data yet'}
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} hasData={metric.hasData ?? live} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendChart live={live} pageViews={live ? PAGE_VIEWS : PAGE_VIEWS.map(() => 0)} revenue={revenueSeries} />
        <RecentActivity live={live} sales={sales} />
      </div>

      <TopAssets live={live} />
    </main>
  )
}

function MetricCard({ label, value, change, note, icon: Icon, hasData, format = formatNumber }) {
  const shown = useCountUp(value)

  return (
    <div className={`${card} p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</span>
        <Icon className="h-4 w-4 text-neutral-400 dark:text-neutral-500" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{format(shown)}</p>
      <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        {hasData ? (
          <span key={`${change}-${note}`} className="fade-in inline-block">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">{change}</span> {note}
          </span>
        ) : (
          'No data yet'
        )}
      </p>
    </div>
  )
}

/** 14-day bar chart with a Page views / Revenue switch. Revenue includes today's real test sales. */
function TrendChart({ live, pageViews, revenue }) {
  const [series, setSeries] = useState('pageViews')
  const isRevenue = series === 'revenue'
  const values = isRevenue ? revenue : pageViews
  const format = isRevenue ? formatAud : formatNumber
  const unit = isRevenue ? 'revenue' : 'views'
  const hasData = values.some((value) => value > 0)

  // Page views use a fixed scale; revenue scales to its peak in clean thirds.
  const max = isRevenue ? Math.max(30, Math.ceil(Math.max(...values) / 30) * 30) : 1500
  const gridlines = [max, (max * 2) / 3, max / 3, 0]

  return (
    <section className={`${card} p-5 lg:col-span-2`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{isRevenue ? 'Revenue (AUD)' : 'Page views'} · last 14 days</h2>
        <div className="flex rounded-md border border-neutral-200 p-0.5 text-xs dark:border-neutral-700" role="group" aria-label="Chart series">
          {[
            ['pageViews', 'Page views'],
            ['revenue', 'Revenue'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSeries(value)}
              aria-pressed={series === value}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                series === value
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        {/* Y axis labels */}
        <div className="flex h-56 w-12 flex-col justify-between text-right text-[10px] tabular-nums text-neutral-400 dark:text-neutral-500">
          {gridlines.map((tick) => (
            <span key={tick} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {format(Math.round(tick))}
            </span>
          ))}
        </div>

        <div className="relative h-56 flex-1">
          {/* Recessive gridlines */}
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
            {gridlines.map((tick) => (
              <span key={tick} className="h-px bg-neutral-100 dark:bg-neutral-800" />
            ))}
          </div>

          {!hasData && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500">
              No {isRevenue ? 'revenue' : 'page views'} recorded yet
            </p>
          )}

          <div className="relative flex h-full items-end gap-[2px]" role="list" aria-label={`Daily ${unit}`}>
            {values.map((value, index) => {
              const day = DAYS[index]
              const today = index === values.length - 1
              const shown = value > 0
              return (
                <div
                  key={day}
                  role="listitem"
                  tabIndex={shown ? 0 : -1}
                  aria-label={`${day}: ${format(value)} ${unit}`}
                  className="group relative flex h-full flex-1 items-end outline-none"
                >
                  <div
                    className="w-full rounded-t-[4px] bg-neutral-800 transition-[height,opacity] duration-700 ease-out group-hover:opacity-80 group-focus-visible:opacity-80 motion-reduce:transition-none dark:bg-neutral-300"
                    style={{
                      height: `${(value / max) * 100}%`,
                      // Bars rise left to right when the data appears.
                      transitionDelay: live ? `${index * 35}ms` : '0ms',
                    }}
                  />
                  {shown && today && (
                    <span className="fade-in absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap pb-1 text-[10px] font-semibold tabular-nums [animation-delay:700ms] group-hover:hidden">
                      {format(value)}
                    </span>
                  )}
                  {shown && (
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs shadow-lg group-hover:block group-focus-visible:block dark:border-neutral-700 dark:bg-neutral-950">
                      <span className="block text-neutral-500 dark:text-neutral-400">{today ? `${day} (today)` : day}</span>
                      <span className="font-semibold tabular-nums">
                        {format(value)} {isRevenue ? '' : 'views'}
                      </span>
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* X axis: first, middle and last dates keep the labels from colliding */}
      <div className="ml-[3.75rem] mt-2 flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500">
        <span>{DAYS[0]}</span>
        <span>{DAYS[7]}</span>
        <span>Today</span>
      </div>
    </section>
  )
}

function RecentActivity({ live, sales }) {
  // Real test purchases first, then (in presentation mode) the sample feed.
  const items = [
    ...sales.map((sale) => ({
      key: sale.sessionId,
      icon: ShoppingBag,
      text: `Premium purchase · ${sale.title}`,
      who: sale.email || 'Stripe test checkout',
      time: timeAgo(sale.at),
      real: true,
    })),
    ...(live ? ACTIVITY.map((item) => ({ ...item, key: `${item.text}-${item.time}` })) : []),
  ].slice(0, 6)

  return (
    <section className={`${card} flex flex-col p-5`}>
      <h2 className="text-sm font-semibold">Recent activity</h2>

      {items.length ? (
        <ul className="mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
          {items.map(({ key, icon: Icon, text, who, time, real }, index) => (
            <li
              key={key}
              className="fade-in flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                  real
                    ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{text}</p>
                <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{who}</p>
              </div>
              <span className="shrink-0 text-[11px] text-neutral-400 dark:text-neutral-500">{time}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
            <Inbox className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="mt-3 text-sm font-medium">No recent activity</p>
          <p className="mt-1 max-w-[16rem] text-xs text-neutral-500 dark:text-neutral-400">
            Purchases, downloads and sign-ups will appear here.
          </p>
        </div>
      )}
    </section>
  )
}

function TopAssets({ live }) {
  const max = TOP_ASSETS[0].downloads

  return (
    <section className={`${card} mt-4 overflow-hidden`}>
      <h2 className="px-5 pt-5 text-sm font-semibold">Top assets this month</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-y border-neutral-100 text-left text-[10px] uppercase tracking-[0.2em] text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
              <th className="px-5 py-2.5 font-medium">Asset</th>
              <th className="px-5 py-2.5 font-medium">Category</th>
              <th className="px-5 py-2.5 text-right font-medium">Downloads</th>
              <th className="w-1/3 px-5 py-2.5 font-medium">
                <span className="sr-only">Share of top asset</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {live ? (
              TOP_ASSETS.map(({ title, category, downloads }, index) => (
                <tr key={title} className="fade-in" style={{ animationDelay: `${index * 60}ms` }}>
                  <td className="px-5 py-3">{title}</td>
                  <td className="px-5 py-3 text-neutral-500 dark:text-neutral-400">{category}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{downloads}</td>
                  <td className="px-5 py-3">
                    <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-neutral-800 dark:bg-neutral-300"
                        style={{ width: `${(downloads / max) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-neutral-400 dark:text-neutral-500">
                  No downloads yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
