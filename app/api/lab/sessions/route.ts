// Archivio delle sessioni di Habeas Mentem Lab.
//
//   POST  deposita una sessione (il JSON esportato dal laboratorio). Il
//         server conserva solo ciò che serve al metodo: clausole, metriche,
//         frizione, porzioni, risposte e compiti. Mai il tracciato grezzo,
//         mai lo pseudonimo, mai gli eventi di navigazione.
//   GET   ?summary=1  → quante sessioni e documenti (per la schermata iniziale)
//         ?document=id → le sessioni di un documento (per il fascicolo aggregato)

import { archivable } from '@/habeas-mentem-lab/src/session/learning'
import { authorized, isMissingTable, json, labDb, MAX_PAYLOAD_BYTES } from '@/lib/lab/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NOT_CONFIGURED = { error: 'Archivio non configurato: eseguire migration_lab.sql su Supabase e impostare le variabili NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (o la chiave anon).', configured: false }

export async function POST(req: Request) {
  if (!authorized(req)) return json({ error: 'Chiave del team mancante o errata (intestazione x-lab-key).' }, 401)
  const db = labDb()
  if (!db) return json(NOT_CONFIGURED, 503)

  const text = await req.text()
  const bytes = Buffer.byteLength(text, 'utf8')
  if (bytes > MAX_PAYLOAD_BYTES) return json({ error: `Sessione troppo grande (${Math.round(bytes / 1024)} kB, massimo ${Math.round(MAX_PAYLOAD_BYTES / 1024)} kB).` }, 413)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return json({ error: 'Il corpo non è JSON.' }, 400)
  }
  const session = archivable(raw)
  if (!session) return json({ error: "Non è un'esportazione di sessione di Habeas Mentem Lab (schema habeas-mentem-lab/session/v1)." }, 400)
  if (!/^[\w.-]{4,80}$/.test(session.session.id)) return json({ error: 'Identificativo di sessione non valido.' }, 400)

  const reading = (session.session as { reading?: { mode?: string } }).reading
  const row = {
    id: session.session.id,
    document_id: session.session.documentId,
    document_title: session.session.documentTitle,
    created_at: new Date(session.session.createdAt).toISOString(),
    simulated: !!session.session.device?.simulated,
    with_signal: session.metrics.some((m) => m.effort && m.effort.sampleCount > 0),
    reading_mode: reading?.mode ?? null,
    clauses: session.clauses.length,
    payload: session,
  }
  const { error } = await db.from('lab_sessions').upsert(row, { onConflict: 'id' })
  if (error) {
    if (isMissingTable(error)) return json(NOT_CONFIGURED, 503)
    return json({ error: `Archivio: ${error.message}` }, 500)
  }
  return json({ ok: true, id: row.id })
}

export async function GET(req: Request) {
  if (!authorized(req)) return json({ error: 'Chiave del team mancante o errata (intestazione x-lab-key).' }, 401)
  const db = labDb()
  if (!db) return json(NOT_CONFIGURED, 503)
  const url = new URL(req.url)
  const document = url.searchParams.get('document')

  if (document) {
    const { data, error } = await db
      .from('lab_sessions')
      .select('payload')
      .eq('document_id', document)
      .order('created_at', { ascending: true })
      .limit(1000)
    if (error) return json(isMissingTable(error) ? NOT_CONFIGURED : { error: error.message }, isMissingTable(error) ? 503 : 500)
    return json({ document, sessions: (data ?? []).map((r) => r.payload) })
  }

  const { data, error } = await db.from('lab_sessions').select('document_id, document_title, simulated, with_signal, created_at').limit(10000)
  if (error) return json(isMissingTable(error) ? NOT_CONFIGURED : { error: error.message }, isMissingTable(error) ? 503 : 500)
  const rows = data ?? []
  const docs = new Map<string, { documentId: string; documentTitle: string; sessions: number; real: number; withSignal: number; last: string }>()
  for (const r of rows) {
    const d = docs.get(r.document_id) ?? { documentId: r.document_id, documentTitle: r.document_title, sessions: 0, real: 0, withSignal: 0, last: r.created_at }
    d.sessions++
    if (!r.simulated) d.real++
    if (r.with_signal) d.withSignal++
    if (r.created_at > d.last) d.last = r.created_at
    docs.set(r.document_id, d)
  }
  return json({ configured: true, sessions: rows.length, documents: docs.size, byDocument: [...docs.values()].sort((a, b) => b.sessions - a.sessions) })
}
