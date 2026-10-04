import { logRun, recentDocuments } from '../memory'
import { buildMatters, newContacts, unbilled, withoutEngagement, type DocLike, type InvoiceLike, type Matter, type TouchLike } from '../practice'
import { parseWhen } from '../slots'
import { senderOf } from '../inbox'
import type { StoredDocument } from '../types'

/**
 * L'agente Studio.
 *
 * La scrivania di Quinn: pratiche per cliente, ore stimate dal
 * calendario e dalla posta, incassi di quel cliente, e tre liste che in
 * uno studio nessuno guarda finché non è tardi — chi assorbe ore senza
 * una fattura dietro, chi lavora con te senza una lettera di incarico
 * in memoria, chi è un nome nuovo di questa settimana (il momento del
 * controllo dei conflitti). Niente modello: è aritmetica su date e
 * partecipanti, e il timesheet vero resta tuo.
 */

const AGENT_KEY = 'practice'
const POOL = 400

export type PracticeReport = {
  examined: number
  matters: Matter[]
  unbilled: Matter[]
  withoutEngagement: Matter[]
  newContacts: Matter[]
}

export async function reviewPractice(ownerEmail: string): Promise<PracticeReport> {
  const started = Date.now()
  const me = ownerEmail.toLowerCase()
  const docs = await recentDocuments(POOL)

  const touches: TouchLike[] = docs
    .filter((d) => d.source === 'gmail' || d.source === 'gcal')
    .map((d) => {
      let minutes: number | null = null
      if (d.source === 'gcal') {
        const line = d.body.match(/^Quando:\s*(.*)$/m)?.[1]
        const when = line ? parseWhen(line) : null
        if (when) minutes = Math.round((Date.parse(when.end) - Date.parse(when.start)) / 60_000)
      }
      return {
        id: d.id,
        kind: d.kind,
        title: d.title,
        occurredAt: d.occurredAt,
        participants: d.participants ?? [],
        minutes,
        fromOwner: d.source === 'gmail' ? senderOf(d.body) === me : false,
      }
    })

  const invoices: InvoiceLike[] = docs
    .filter((d) => d.source === 'qonto' && d.metadata?.side === 'credit')
    .map((d) => ({
      id: d.id,
      counterparty: String(d.metadata?.counterparty ?? d.title),
      amountCents: Math.round(Math.abs(Number(d.metadata?.amount ?? 0)) * 100),
      occurredAt: d.occurredAt,
    }))

  const files: DocLike[] = docs
    .filter((d): d is StoredDocument => d.source === 'gdrive' || d.source === 'manual')
    .map((d) => ({ id: d.id, title: d.title, occurredAt: d.occurredAt }))

  const matters = buildMatters(touches, invoices, files, ownerEmail)
  const report: PracticeReport = {
    examined: docs.length,
    matters: matters.slice(0, 30),
    unbilled: unbilled(matters).slice(0, 10),
    withoutEngagement: withoutEngagement(matters).slice(0, 10),
    newContacts: newContacts(matters).slice(0, 10),
  }

  await logRun({
    agent: AGENT_KEY,
    question: 'pratiche, ore e fatturato',
    answer: { examined: docs.length, matters: matters.length, unbilled: report.unbilled.length, withoutEngagement: report.withoutEngagement.length, newContacts: report.newContacts.length },
    model: 'nessuno (deterministico)',
    hits: matters.length,
    latencyMs: Date.now() - started,
  })
  return report
}
