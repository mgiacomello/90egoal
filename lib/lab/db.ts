// Archivio di Habeas Mentem Lab su Supabase.
//
// Due tabelle (migration_lab.sql): lab_sessions, una riga per sessione
// (risultati per clausola e per porzione, senza tracciato grezzo né
// pseudonimo) e lab_models, una riga per ogni modello ricalcolato. Il
// laboratorio (habeas-mentem-lab) parla solo con le API di questo sito.
//
// Credenziali: NEXT_PUBLIC_SUPABASE_URL e, se presente,
// SUPABASE_SERVICE_ROLE_KEY (consigliata: bypassa le policy e permette di
// tenere le tabelle chiuse al pubblico); altrimenti la chiave anon, con le
// policy della migrazione. LAB_TEAM_KEY, se impostata, è la chiave che il
// team inserisce nel laboratorio; senza, l'archivio accetta chiunque.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const SESSION_SCHEMA = 'habeas-mentem-lab/session/v1'
export const MAX_PAYLOAD_BYTES = 1_500_000
export const MAX_SESSIONS_FOR_MODEL = 3000

let cached: SupabaseClient | null = null

export function labDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (!cached) cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return cached
}

/** true se la richiesta porta la chiave del team (o se nessuna chiave è richiesta). */
export function authorized(req: Request): boolean {
  const required = process.env.LAB_TEAM_KEY
  if (!required) return true
  const given = req.headers.get('x-lab-key') ?? new URL(req.url).searchParams.get('key') ?? ''
  return timingSafeEqual(given, required)
}

/** Il cron di Vercel manda Authorization: Bearer CRON_SECRET. */
export function isCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return timingSafeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Un errore di Supabase che dice "tabella assente" → l'archivio non è ancora configurato. */
export function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(err.message ?? ''))
}
