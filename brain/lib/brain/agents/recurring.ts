import { logRun, recentDocuments } from '../memory'
import { findSubscriptions, yearlyTotal, type ChargeLike, type Subscription } from '../recurring'

/**
 * L'agente Abbonamenti.
 *
 * Quello che si paga senza più deciderlo, messo davanti agli occhi:
 * quanto costa all'anno, se è aumentato, quando passa la prossima
 * volta, e cosa sembra finito. Niente modello: è un estratto conto
 * letto con un calendario in mano.
 */

const AGENT_KEY = 'recurring'

export type RecurringReport = {
  months: number
  examined: number
  subscriptions: Subscription[]
  yearlyCents: number
}

export async function reviewSubscriptions(months = 12): Promise<RecurringReport> {
  const started = Date.now()
  const since = Date.now() - months * 30.5 * 86_400_000

  const docs = (await recentDocuments(200, 'qonto')).filter((d) => Date.parse(d.occurredAt) >= since)
  const charges: ChargeLike[] = docs
    .filter((d) => d.metadata?.side !== 'credit')
    .map((d) => ({
      id: d.id,
      label: String(d.metadata?.counterparty ?? d.title),
      amountCents: Math.round(Math.abs(Number(d.metadata?.amount ?? 0)) * 100),
      occurredAt: d.occurredAt,
    }))

  const subscriptions = findSubscriptions(charges)
  const report: RecurringReport = { months, examined: charges.length, subscriptions, yearlyCents: yearlyTotal(subscriptions) }

  await logRun({
    agent: AGENT_KEY,
    question: `abbonamenti negli ultimi ${months} mesi`,
    answer: { examined: charges.length, subscriptions: subscriptions.length, yearlyCents: report.yearlyCents },
    model: 'nessuno (deterministico)',
    hits: subscriptions.length,
    latencyMs: Date.now() - started,
  })
  return report
}
