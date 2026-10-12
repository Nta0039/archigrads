/**
 * Weekly flash sales, shared by the page (display, countdown) and
 * /api/checkout (the amount actually charged), so the two always agree.
 *
 * Sale days run on Sydney time (AEST/AEDT, the business's own clock): the
 * promo price applies Monday 00:00 to Friday 23:59:59; the asset's normal
 * price (from Supabase) applies on Saturday and Sunday.
 */
export const SALE_TIME_ZONE = 'Australia/Sydney'

const FLASH_SALES = {
  'university-level-7': { promoCents: 100 }, // A$1 on weekdays, normally A$5
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const parts = new Intl.DateTimeFormat('en-AU', {
  timeZone: SALE_TIME_ZONE,
  weekday: 'short',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
})

/** Wall-clock fields of an instant in Sydney. */
function sydneyClock(date) {
  const fields = Object.fromEntries(parts.formatToParts(date).map((part) => [part.type, part.value]))
  return {
    weekday: WEEKDAYS[fields.weekday],
    year: Number(fields.year),
    month: Number(fields.month),
    day: Number(fields.day),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
    second: Number(fields.second),
  }
}

/** The UTC instant of a Sydney wall-clock midnight (handles daylight saving). */
function sydneyMidnight(year, month, day) {
  const wall = Date.UTC(year, month - 1, day)
  let instant = wall
  for (let i = 0; i < 2; i++) {
    const seen = sydneyClock(new Date(instant))
    const offset = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second) - instant
    instant = wall - offset
  }
  return instant
}

/**
 * { active, priceCents, normalCents, endsAt } for an asset at a moment, or
 * null when the asset has no flash sale. endsAt (ms) is the coming Saturday
 * 00:00 Sydney time, when the weekday promo ends.
 */
export function flashSale(assetId, normalCents, now = Date.now()) {
  const sale = FLASH_SALES[assetId]
  if (!sale || !normalCents) return null
  const clock = sydneyClock(new Date(now))
  const active = clock.weekday >= 1 && clock.weekday <= 5
  // Days from today to Saturday, then that date's midnight in Sydney.
  const ahead = (6 - clock.weekday + 7) % 7
  const saturday = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + ahead))
  const endsAt = sydneyMidnight(saturday.getUTCFullYear(), saturday.getUTCMonth() + 1, saturday.getUTCDate())
  return { active, priceCents: active ? sale.promoCents : normalCents, normalCents, endsAt }
}
