import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client.
 *
 * Reads the project credentials from Vite environment variables at build time.
 * Copy `.env.example` to `.env` and paste your project's values (Project
 * Settings -> API). Only variables prefixed with `VITE_` are exposed to the
 * browser, and the anon key is a publishable key that is safe to ship — access
 * to data is enforced by row level security.
 */
const supabaseUrl = normaliseSupabaseUrl(import.meta.env.VITE_SUPABASE_URL)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Accepts either the bare project URL (https://ref.supabase.co) or a pasted
 * REST endpoint (https://ref.supabase.co/rest/v1/) and trims it back to the
 * origin, which is what createClient expects.
 */
function normaliseSupabaseUrl(value) {
  if (!value) return ''
  return value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
}

/** True once both env vars are present, so callers can degrade gracefully. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

export default supabase
