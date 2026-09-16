'use client'

import { useState } from 'react'
import type { LedgerReport } from '@/lib/brain/agents/ledger'
import { formatEuro, formatDay } from '@/lib/brain/reconcile'

/**
 * La scheda Amministrazione.
 *
 * L'ordine in cui le cose compaiono è la cosa più utile di questo
 * pannello: **prima i movimenti per cui non esiste nessuna fattura in
 * memoria**, perché quelli sono lavoro da fare — una mail da mandare —
 * mentre gli altri sono solo da confermare.
 *
 * Ogni abbinamento porta con sé le sue ragioni in chiaro (importo, nome,
 * distanza in giorni): chi guarda deve poter dire "sì, è questa" senza
 * aprire niente.
 */

const PERIODS: { label: string; days: number }[] = [
  { label: '30 giorni', days: 30 },
  { label: '90 giorni', days: 90 },
  { label: '1 anno', days: 365 },
]

function CopyButton({ text, label = 'copia la mail' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className="brain-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1600)
        } catch {
          setDone(false)
        }
      }}
    >
      {done ? '✓ copiata' : label}
    </button>
  )
}

export default function LedgerPanel() {
  const [days, setDays] = useState(90)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<LedgerReport | null>(null)
  const [openDraft, setOpenDraft] = useState<string | null>(null)

  async function run(period: number) {
    if (busy) return
    setBusy(true)
    setError(null)
    setDays(period)
    try {
      const res = await fetch(`/api/brain/ledger?days=${period}`)
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Controllo non riuscito.')
      else setReport(data as LedgerReport)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="brain-actions" style={{ marginBottom: '1rem' }}>
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            className="brain-chip"
            aria-pressed={days === p.days}
            onClick={() => void run(p.days)}
            disabled={busy}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className="brain-btn brain-btn-primary" onClick={() => void run(days)} disabled={busy}>
          {busy ? 'Controllo…' : 'Controlla i movimenti'}
        </button>
      </div>

      <p className="brain-note">
        Questo agente <b>non usa nessun modello</b>. Abbinare una fattura a un addebito è aritmetica —
        importo, data, nome — e l&apos;aritmetica non si delega a qualcosa che ogni tanto può leggere
        male una cifra. Funziona anche senza chiave AI, e risponde subito.
      </p>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {report ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={report.missing ? 'warn' : 'ok'}>
            <span className="brain-verdict-label">
              {report.missing
                ? `${report.missing} giustificativ${report.missing === 1 ? 'o' : 'i'} da sistemare`
                : 'tutto a posto'}
            </span>
            <p>
              {report.missing
                ? `Su ${report.examined} pagamenti degli ultimi ${report.days} giorni, ${report.missing} sono senza allegato, per € ${formatEuro(report.missingCents)} in totale. Di questi, ${report.resolvable} hanno già in memoria una fattura che corrisponde quasi certamente.`
                : `Tutti i ${report.examined} pagamenti degli ultimi ${report.days} giorni hanno il loro giustificativo.`}
            </p>
          </div>

          {report.rows.map((row) => (
            <article key={row.transaction.id} className="brain-clause" data-risk={row.candidates.length ? 'basso' : 'alto'}>
              <header className="brain-clause-head">
                <span className="brain-risk" data-risk={row.candidates.length ? 'basso' : 'alto'}>
                  {row.candidates.length ? 'fattura trovata' : 'fattura assente'}
                </span>
                <h3>
                  € {formatEuro(row.transaction.amountCents)} — {row.transaction.label}
                </h3>
                <span className="brain-meta">{formatDay(row.transaction.occurredAt)}</span>
              </header>

              {row.candidates.length ? (
                <div className="brain-list">
                  {row.candidates.map((c) => (
                    <div key={c.documentId} className="brain-row">
                      <span className="brain-dot" data-state={c.confidence === 'certa' ? 'connected' : 'configured'} />
                      <div className="brain-row-main">
                        <div className="brain-row-title">{c.title || '(senza titolo)'}</div>
                        <div className="brain-row-hint">{c.why.join(' · ')}</div>
                      </div>
                      <span className="brain-tag">{c.confidence}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <p className="brain-row-hint" style={{ marginBottom: '0.625rem' }}>
                    In memoria non c&apos;è nessun documento con questo importo. O la fattura non è
                    mai arrivata, o è in un posto che BRAIN non legge.
                  </p>
                  <div className="brain-actions">
                    <button
                      type="button"
                      className="brain-btn"
                      onClick={() => setOpenDraft(openDraft === row.transaction.id ? null : row.transaction.id)}
                    >
                      {openDraft === row.transaction.id ? 'Nascondi la mail' : 'Chiedi la fattura'}
                    </button>
                    <CopyButton text={row.draft} />
                  </div>
                  {openDraft === row.transaction.id ? (
                    <pre className="brain-quote" style={{ marginTop: '0.75rem' }}>
                      {row.draft}
                    </pre>
                  ) : null}
                </div>
              )}
            </article>
          ))}

          {!report.rows.length && report.examined === 0 ? (
            <p className="brain-empty">
              Nessun pagamento in memoria per questo periodo. Collega Qonto nella scheda Fonti e
              sincronizza.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
