import { logRun, recentDocuments } from '../memory'
import { buildRelations, cooling, mostActive, type Relation } from '../relations'
import type { StoredDocument } from '../types'

/**
 * L'agente Relazioni.
 *
 * Il CRM che non si compila: chi compare nelle mail e negli incontri,
 * con che ritmo, e soprattutto **chi si sta raffreddando** — una
 * relazione che aveva un ritmo e da un po' tace. Aritmetica sulle
 * date, senza modello. Ogni riga porta gli ultimi documenti in cui la
 * persona compare, così "non lo sento da 40 giorni" si verifica in un
 * tocco.
 */

const AGENT_KEY = 'relations'
const POOL = 400

export type RelationRow = Relation & {
  recent: { id: string; title: string; occurredAt: string; source: StoredDocument['source']; url: string | null }[]
}

export type RelationsReport = {
  examined: number
  relations: number
  cooling: RelationRow[]
  active: RelationRow[]
}

export async function reviewRelations(ownerEmail: string): Promise<RelationsReport> {
  const started = Date.now()
  const docs = (await recentDocuments(POOL)).filter((d) => d.source === 'gmail' || d.source === 'gcal')
  const byId = new Map(docs.map((d) => [d.id, d]))

  const relations = buildRelations(
    docs.map((d) => ({ id: d.id, kind: d.kind, title: d.title, occurredAt: d.occurredAt, participants: d.participants ?? [] })),
    ownerEmail
  )
  const enrich = (r: Relation): RelationRow => ({
    ...r,
    recent: r.recentIds
      .map((id) => byId.get(id))
      .filter((d): d is StoredDocument => Boolean(d))
      .map((d) => ({ id: d.id, title: d.title, occurredAt: d.occurredAt, source: d.source, url: d.url ?? null })),
  })

  const report: RelationsReport = {
    examined: docs.length,
    relations: relations.length,
    cooling: cooling(relations).slice(0, 12).map(enrich),
    active: mostActive(relations, 8).map(enrich),
  }

  await logRun({
    agent: AGENT_KEY,
    question: 'relazioni: chi si sta raffreddando',
    answer: { examined: docs.length, relations: relations.length, cooling: report.cooling.length },
    model: 'nessuno (deterministico)',
    hits: relations.length,
    latencyMs: Date.now() - started,
  })
  return report
}
