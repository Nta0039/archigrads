import { createClient } from '@supabase/supabase-js'
import { HttpError } from './_stripe.js'

const DEFAULT_URL = 'https://eacxrglkllttghdpbrff.supabase.co'
let client = null

/**
 * Server-only Supabase client using the service-role key, which can read the
 * private "source-files" bucket. Never import this from browser code.
 */
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new HttpError(500, 'Supabase is not configured (missing SUPABASE_SERVICE_ROLE_KEY).')
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_URL
  client ??= createClient(url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, ''), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
