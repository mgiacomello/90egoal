import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { BrainError } from './errors'

/**
 * Accesso alla memoria con la service role key.
 *
 * Le tabelle `brain_*` hanno RLS attiva e nessuna policy: dal browser
 * non sono raggiungibili nemmeno da loggati. Questa è l'unica porta,
 * e sta sempre e solo lato server.
 */
let cached: SupabaseClient | null = null

export function brainDb(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new BrainError(
      'Memoria non configurata: servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
      503
    )
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

export function memoryConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}
