import type { BrainDocument } from '../types'
import { BrainError } from '../errors'
import { formatEuro } from '../reconcile'
import { clip, type Connector, type SyncWindow } from './types'

/**
 * Qonto, in sola lettura.
 *
 * Detto chiaro, perché è il punto che conta in un sistema di agenti:
 * **questo connettore non muove denaro e non può farlo.** Legge le
 * transazioni e le mette in memoria, così un agente può dire "questa
 * fattura corrisponde a questo addebito". Disporre un bonifico è
 * un'altra cosa, richiede l'autenticazione forte del titolare e resta
 * fuori da qui per scelta, non per mancanza di tempo.
 */

const API = 'https://thirdparty.qonto.com/v2'

type QontoAccount = { id?: string; slug?: string; iban?: string; name?: string; currency?: string }
type QontoTransaction = {
  transaction_id?: string
  id?: string
  amount?: number
  amount_cents?: number
  currency?: string
  side?: 'credit' | 'debit'
  operation_type?: string
  status?: string
  label?: string
  reference?: string
  note?: string
  settled_at?: string
  emitted_at?: string
  attachment_ids?: string[]
  vat_amount?: number
  initiator_id?: string
}

function credentials(): { login: string; secret: string } {
  const login = process.env.QONTO_LOGIN
  const secret = process.env.QONTO_SECRET_KEY
  if (!login || !secret) {
    throw new BrainError('Qonto non configurato: servono QONTO_LOGIN e QONTO_SECRET_KEY.', 503)
  }
  return { login, secret }
}

async function qontoJson<T>(path: string): Promise<T> {
  const { login, secret } = credentials()
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `${login}:${secret}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new BrainError(`Qonto ha risposto ${res.status}: ${detail.slice(0, 300)}`, 502)
  }
  return (await res.json()) as T
}

function amountOf(tx: QontoTransaction): number {
  if (typeof tx.amount === 'number') return tx.amount
  if (typeof tx.amount_cents === 'number') return tx.amount_cents / 100
  return 0
}

/**
 * L'importo come finisce dentro al documento in memoria.
 *
 * Non usa `Intl`: questa stringa viene riletta da `parseAmounts()` per
 * abbinare le fatture ai movimenti, e la forma che `Intl` produce
 * dipende dalla build ICU del runtime. Un importo che si scrive in un
 * modo in sviluppo e in un altro in produzione è un abbinamento che
 * salta senza che nessuno capisca perché.
 */
function money(value: number, currency = 'EUR'): string {
  return `${formatEuro(Math.round(value * 100))} ${currency}`
}

function toDocument(tx: QontoTransaction, accountLabel: string): BrainDocument | null {
  const id = tx.transaction_id ?? tx.id
  if (!id) return null

  const value = amountOf(tx)
  const currency = tx.currency ?? 'EUR'
  const incoming = tx.side === 'credit'
  const label = tx.label?.trim() || '(controparte non indicata)'
  const signed = money(incoming ? value : -value, currency)

  const lines = [
    `Conto: ${accountLabel}`,
    `Controparte: ${label}`,
    `Importo: ${signed}`,
    `Tipo: ${tx.operation_type ?? '—'}${tx.status ? ` (${tx.status})` : ''}`,
    tx.reference ? `Riferimento: ${tx.reference}` : '',
    tx.note ? `Nota: ${tx.note}` : '',
    typeof tx.vat_amount === 'number' ? `IVA: ${money(tx.vat_amount, currency)}` : '',
    // Serve a un agente amministrativo per sapere cosa manca ancora.
    `Giustificativo: ${tx.attachment_ids?.length ? `${tx.attachment_ids.length} allegato/i` : 'assente'}`,
  ].filter(Boolean)

  return {
    source: 'qonto',
    kind: 'transaction',
    externalId: id,
    title: `${incoming ? 'Incasso' : 'Pagamento'} ${signed} — ${label}`,
    body: clip(lines.join('\n')),
    occurredAt: tx.settled_at ?? tx.emitted_at ?? new Date().toISOString(),
    url: null,
    participants: [],
    metadata: {
      side: tx.side,
      // La controparte in chiaro: l'agente Amministrazione la confronta
      // coi nomi nelle fatture, e ricavarla dal titolo sarebbe fragile.
      counterparty: label,
      amount: value,
      currency,
      operationType: tx.operation_type,
      status: tx.status,
      hasAttachment: Boolean(tx.attachment_ids?.length),
    },
  }
}

export const qontoConnector: Connector = {
  key: 'qonto',
  label: 'Qonto',
  hint: 'Chiave API in sola lettura (QONTO_LOGIN, QONTO_SECRET_KEY). Non muove denaro.',
  configured: () => Boolean(process.env.QONTO_LOGIN && process.env.QONTO_SECRET_KEY),

  async connected() {
    if (!this.configured()) return false
    try {
      await qontoJson('/organization')
      return true
    } catch {
      return false
    }
  },

  async fetch({ since, limit }: SyncWindow): Promise<BrainDocument[]> {
    const org = await qontoJson<{ organization?: { bank_accounts?: QontoAccount[] } }>('/organization')
    const accounts = org.organization?.bank_accounts ?? []
    if (!accounts.length) return []

    const perAccount = Math.max(1, Math.floor(limit / accounts.length))
    const docs: BrainDocument[] = []

    for (const account of accounts) {
      const id = account.id ?? account.slug
      if (!id) continue

      const label = account.name ?? account.iban ?? id
      const params = new URLSearchParams({
        bank_account_id: id,
        settled_at_from: since.toISOString(),
        per_page: String(Math.min(perAccount, 100)),
      })

      const data = await qontoJson<{ transactions?: QontoTransaction[] }>(`/transactions?${params}`)
      for (const tx of data.transactions ?? []) {
        const doc = toDocument(tx, label)
        if (doc) docs.push(doc)
      }
    }

    return docs
  },
}
