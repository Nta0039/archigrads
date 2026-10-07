/**
 * "Flowing light border": a 2px border with a silver-to-cyan beam sweeping
 * around it, a soft drop shadow and a bold label. Shared by the AI Studio nav
 * button and the "AI Generated" category pill so both animate identically.
 *
 * Add padding at the call site (the 2px border is 1px wider than a normal
 * button's, so take 1px off its usual padding to keep the same size).
 * Keyframes and colour tokens (--ai-*) live in src/index.css.
 */
export const FLOWING_BORDER =
  'border-2 border-transparent font-semibold text-neutral-950 shadow-lg shadow-neutral-400/50 ' +
  '[background:linear-gradient(var(--ai-fill),var(--ai-fill))_padding-box,conic-gradient(from_var(--ai-angle),var(--ai-edge)_0deg,var(--ai-edge)_190deg,var(--ai-tail)_250deg,var(--ai-beam)_300deg,var(--ai-flash)_318deg,var(--ai-beam)_328deg,var(--ai-edge)_350deg)_border-box] ' +
  'animate-[ai-border-flow_4s_linear_infinite] motion-reduce:animate-none ' +
  'hover:shadow-neutral-500/60 dark:text-white dark:shadow-white/20 dark:hover:shadow-white/30'
