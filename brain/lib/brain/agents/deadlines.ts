import { extractDeadlines, selectDeadlines, urgency, type Deadline, type Urgency } from '../deadlines'
import { logRun, recentDocuments } from '../memory'
import type { SourceKey, StoredDocument } from '../types'

/**
 * L'agente Scadenze.
 *
 * Risponde alla domanda che per chi fa l'avvocato vale più di tutte le
 * altre: **entro quando devo muovermi?** L'ultima data utile per
 * disdire un contratto, il termine di una diffida, la scadenza di una
 * licenza — tutto quello che in memoria ha una data davanti.
 *
 * Come l'Amministrazione, **non usa nessun modello**: una data si legge
 * e una durata si somma, e un modello che "stima" una scadenza è la
 * cosa più pericolosa che si possa mettere davanti a un avvocato. Ogni
 * riga porta la frase del documento da cui viene, e per le date
 * calcolate il calcolo è scritto per esteso — perché il giorno esatto
 * (lo stesso o quello prima) lo decide il contratto, non il codice.
 */

const AGENT_KEY = 'deadlines'
const POOL = 400

export type DeadlineRow = Deadline & {
  title: string
  source: SourceKey
  url: string | null
  urgency: Urgency
}

export type DeadlinesReport = {
  today: string
  horizonDays: number
  examined: number
  rows: DeadlineRow[]
}

export async function reviewDeadlines(horizonDays = 120): Promise<DeadlinesReport> {
  const started = Date.now()
  const today = new Date().toISOString().slice(0, 10)

  const docs = (await recentDocuments(POOL)).filter((d) =>
    d.source === 'gdrive' || d.source === 'gmail' || d.source === 'manual'
  )
  const byId = new Map<string, StoredDocument>(docs.map((d) => [d.id, d]))

  const all = docs.flatMap((d) =>
    extractDeadlines({ id: d.id, title: d.title, text: `${d.title}\n${d.body}`, occurredAt: d.occurredAt })
  )
  const rows: DeadlineRow[] = selectDeadlines(all, today, horizonDays).map((d) => {
    const doc = byId.get(d.documentId)!
    return { ...d, title: doc.title, source: doc.source, url: doc.url ?? null, urgency: urgency(d.date, today) }
  })

  const report: DeadlinesReport = { today, horizonDays, examined: docs.length, rows }

  await logRun({
    agent: AGENT_KEY,
    question: `scadenze nei prossimi ${horizonDays} giorni`,
    answer: { examined: docs.length, rows: rows.length, scadute: rows.filter((r) => r.urgency === 'scaduta').length },
    model: 'nessuno (deterministico)',
    hits: rows.length,
    latencyMs: Date.now() - started,
  })

  return report
}
