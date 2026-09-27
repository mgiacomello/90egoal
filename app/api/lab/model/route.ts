// Il modello appreso da Habeas Mentem Lab.
//
// GET restituisce l'ultimo modello; se dall'ultimo calcolo sono arrivate
// sessioni nuove (o il modello ha più di un giorno, o ?refresh=1), lo
// ricalcola qui, lo salva in lab_models e lo restituisce. Così il
// laboratorio impara da solo: ogni apertura del laboratorio, e il cron
// notturno di Vercel, sono occasioni di aggiornamento. Il modello non
// contiene dati personali: è pubblico come il metodo.

import { learn, usableExports, EMPTY_MODEL, type LabModel } from '@/habeas-mentem-lab/src/session/learning'
import { authorized, isCron, isMissingTable, json, labDb, MAX_SESSIONS_FOR_MODEL } from '@/lib/lab/db'

/**
 * Senza chiave del team il modello resta leggibile (è il metodo, pubblico),
 * ma senza i testi delle porzioni e delle frasi: i documenti incollati dal
 * team possono essere riservati. Numeri e parole singole restano.
 */
function withoutTexts(model: LabModel): LabModel {
  return {
    ...model,
    documents: model.documents.map((d) => ({
      ...d,
      segments: d.segments.map((s) => ({ ...s, text: '' })),
      sentences: d.sentences.map((s) => ({ ...s, text: '' })),
    })),
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_AGE_MS = 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  const db = labDb()
  if (!db) return json({ model: EMPTY_MODEL, configured: false, error: 'Archivio non configurato.' }, 200)
  const url = new URL(req.url)
  const trusted = authorized(req) || isCron(req)
  // Il ricalcolo forzato costa: solo con la chiave del team o dal cron.
  const force = (url.searchParams.get('refresh') === '1' && trusted) || isCron(req)
  const shape = (m: LabModel) => (trusted ? m : withoutTexts(m))

  const latest = await db.from('lab_models').select('id, computed_at, sessions, model').order('computed_at', { ascending: false }).limit(1).maybeSingle()
  if (latest.error) {
    if (isMissingTable(latest.error)) return json({ model: EMPTY_MODEL, configured: false, error: 'Tabelle assenti: eseguire migration_lab.sql.' }, 200)
    return json({ error: latest.error.message }, 500)
  }

  let stale = force || !latest.data
  if (!stale && latest.data) {
    const computedAt = new Date(latest.data.computed_at).getTime()
    if (Date.now() - computedAt > MAX_AGE_MS) stale = true
    else {
      const fresh = await db.from('lab_sessions').select('id', { count: 'exact', head: true }).gt('inserted_at', latest.data.computed_at)
      if (!fresh.error && (fresh.count ?? 0) > 0) stale = true
    }
  }

  if (!stale && latest.data) return json({ model: shape(latest.data.model as LabModel), configured: true, recomputed: false })

  // L'istante del modello precede la lettura: una sessione arrivata durante il calcolo verrà ripresa la volta dopo.
  const now = new Date()
  const rows = await db.from('lab_sessions').select('payload').order('created_at', { ascending: false }).limit(MAX_SESSIONS_FOR_MODEL)
  if (rows.error) return json({ error: rows.error.message }, 500)
  const exportsList = usableExports((rows.data ?? []).map((r) => r.payload))
  let model: LabModel
  try {
    model = learn(exportsList, now)
  } catch (e) {
    // Una sessione malformata non deve spegnere il modello per tutti: vale l'ultimo salvato.
    const previous = latest.data?.model as LabModel | undefined
    return json({ model: shape(previous ?? EMPTY_MODEL), configured: true, recomputed: false, warning: `Ricalcolo fallito: ${e instanceof Error ? e.message : String(e)}` })
  }
  const saved = await db.from('lab_models').insert({ computed_at: model.computedAt, sessions: model.sessions, model })
  if (saved.error && !isMissingTable(saved.error)) return json({ model: shape(model), configured: true, recomputed: true, warning: `Modello non salvato: ${saved.error.message}` })
  // Tiene solo gli ultimi 50 modelli: la storia del metodo, non un magazzino.
  const old = await db.from('lab_models').select('id').order('computed_at', { ascending: false }).range(50, 1000)
  if (!old.error && old.data && old.data.length) await db.from('lab_models').delete().in('id', old.data.map((r) => r.id))
  return json({ model: shape(model), configured: true, recomputed: true })
}
