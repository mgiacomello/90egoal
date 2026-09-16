import { logRun, recentDocuments } from '../memory'
import { reconcile, requestInvoiceText, type Reconciliation } from '../reconcile'
import type { StoredDocument } from '../types'

/**
 * L'agente Amministrazione.
 *
 * Risponde a una domanda sola, ma è quella che costa più ore di
 * chiunque altra: **di quali soldi usciti non ho la fattura, e dove
 * sta quella che ho già?**
 *
 * A differenza degli altri due agenti, questo **non chiama nessun
 * modello**. Non è una scorciatoia: abbinare una fattura a un addebito
 * è aritmetica — importo, data, nome — e delegarla a qualcosa che ogni
 * tanto può leggere male una cifra sarebbe un peggioramento pagato
 * anche in latenza e in costo. Il modello serve dove serve giudizio;
 * qui serve precisione.
 *
 * Conseguenza pratica: questa scheda funziona anche senza
 * `ANTHROPIC_API_KEY`, e risponde in un decimo di secondo.
 */

const AGENT_KEY = 'ledger'

/** Quanti documenti pescare come possibili fatture. */
const CANDIDATE_POOL = 400

export type LedgerRow = Reconciliation & {
  /** La mail pronta da mandare, costruita dai dati del movimento. */
  draft: string
}

export type LedgerReport = {
  /** Giorni guardati all'indietro. */
  days: number
  /** Movimenti in uscita esaminati nella finestra. */
  examined: number
  /** Quanti sono senza giustificativo. */
  missing: number
  /** Di questi, quanti hanno un candidato dato per certo. */
  resolvable: number
  /** Totale in centesimi dei movimenti senza giustificativo. */
  missingCents: number
  rows: LedgerRow[]
}

function toTx(doc: StoredDocument) {
  const meta = doc.metadata ?? {}
  const amount = typeof meta.amount === 'number' ? meta.amount : 0
  return {
    id: doc.id,
    label: String(meta.counterparty ?? '') || doc.title.replace(/^(Pagamento|Incasso)\s+\S+\s+—\s+/, ''),
    // Le fatture sono sempre positive: il segno del movimento qui non serve.
    amountCents: Math.round(Math.abs(amount) * 100),
    occurredAt: doc.occurredAt,
    hasAttachment: meta.hasAttachment === true,
    side: meta.side === 'credit' ? 'credit' : 'debit',
  }
}

export async function reviewLedger(days = 90): Promise<LedgerReport> {
  const started = Date.now()
  const since = Date.now() - days * 86_400_000

  const [transactions, everything] = await Promise.all([
    recentDocuments(200, 'qonto'),
    recentDocuments(CANDIDATE_POOL),
  ])

  const inWindow = transactions.filter((d) => Date.parse(d.occurredAt) >= since)

  // Un incasso non ha un giustificativo da cercare: la fattura l'hai
  // emessa tu. Qui si guardano i soldi usciti.
  const outgoing = inWindow.map(toTx).filter((t) => t.side === 'debit' && t.amountCents > 0)

  const candidates = everything
    .filter((d) => d.source !== 'qonto')
    .map((d) => ({ id: d.id, title: d.title, text: `${d.title}\n${d.body}`, occurredAt: d.occurredAt }))

  const reconciled = reconcile(outgoing, candidates)

  const rows: LedgerRow[] = reconciled.map((r) => ({
    ...r,
    draft: requestInvoiceText(r.transaction),
  }))

  const report: LedgerReport = {
    days,
    examined: outgoing.length,
    missing: reconciled.length,
    resolvable: reconciled.filter((r) => r.candidates.some((c) => c.confidence === 'certa')).length,
    missingCents: reconciled.reduce((sum, r) => sum + r.transaction.amountCents, 0),
    rows,
  }

  await logRun({
    agent: AGENT_KEY,
    question: `giustificativi mancanti, ultimi ${days} giorni`,
    answer: {
      examined: report.examined,
      missing: report.missing,
      resolvable: report.resolvable,
      missingCents: report.missingCents,
    },
    // Nessun modello: la riga nel registro lo dice, invece di lasciarlo vuoto.
    model: 'nessuno (deterministico)',
    hits: report.missing,
    latencyMs: Date.now() - started,
  })

  return report
}
