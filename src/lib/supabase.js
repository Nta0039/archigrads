import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client.
 *
 * Uses VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY when set, otherwise this
 * project's public URL and publishable key. Both are public by design (every
 * visitor's browser receives them); row level security decides what they can
 * do: read the published catalogue, nothing else. The service-role key is
 * never used here.
 */
const DEFAULT_URL = 'https://eacxrglkllttghdpbrff.supabase.co'
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_2pUqOcjNCF7DVCh1ghfDlA_lHhCR41o'

const supabaseUrl = normaliseSupabaseUrl(import.meta.env.VITE_SUPABASE_URL) || DEFAULT_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || DEFAULT_PUBLISHABLE_KEY

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
