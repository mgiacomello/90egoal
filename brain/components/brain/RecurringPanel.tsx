'use client'

import { useState } from 'react'
import type { RecurringReport } from '@/lib/brain/agents/recurring'
import { formatEuro } from '@/lib/brain/reconcile'

/**
 * La scheda Abbonamenti.
 *
 * Una lista dal più caro all'anno. Accanto a ogni riga le tre cose che
 * contano: quando ripassa, se è aumentato, se sembra finito. Il totale
 * in cima, perché è il numero che fa smettere di pagare quello che non
 * si usa.
 */

const PERIODS = [
  { label: '6 mesi', months: 6 },
  { label: '12 mesi', months: 12 },
  { label: '24 mesi', months: 24 },
]

function itDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

export default function RecurringPanel() {
  const [months, setMonths] = useState(12)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<RecurringReport | null>(null)

  async function run(period: number) {
    if (busy) return
    setBusy(true)
    setError(null)
    setMonths(period)
    try {
      const res = await fetch(`/api/brain/recurring?months=${period}`)
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a leggere i movimenti.')
      else setReport(data as RecurringReport)
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
          <button key={p.months} type="button" className="brain-chip" aria-pressed={months === p.months} onClick={() => void run(p.months)} disabled={busy}>
            {p.label}
          </button>
        ))}
        <button type="button" className="brain-btn brain-btn-primary" onClick={() => void run(months)} disabled={busy}>
          {busy ? 'Leggo il conto…' : 'Cosa pago senza deciderlo'}
        </button>
      </div>

      <details className="brain-how">
        <summary>Come funziona</summary>
        <p className="brain-note">
          Un abbonamento è una cosa che si paga senza più deciderlo. Qui è <b>calcolato</b>: stessa
          controparte, stessa cadenza, almeno tre addebiti. Gli importi possono variare — un canone a
          consumo resta un canone — conta la regolarità nel tempo. Senza modello.
        </p>
      </details>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {report ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={report.subscriptions.length ? 'warn' : 'ok'}>
            <span className="brain-verdict-label">
              {report.subscriptions.length
                ? `€ ${formatEuro(report.yearlyCents)} all'anno`
                : 'nessun addebito ricorrente'}
            </span>
            <p>
              {report.subscriptions.length
                ? `${report.subscriptions.length} abbonament${report.subscriptions.length === 1 ? 'o' : 'i'} riconosciut${report.subscriptions.length === 1 ? 'o' : 'i'} su ${report.examined} addebiti degli ultimi ${report.months} mesi. Il totale esclude quelli che sembrano finiti.`
                : `Su ${report.examined} addebiti degli ultimi ${report.months} mesi nessuno tiene una cadenza.`}
            </p>
            <span className="brain-meta">calcolato senza modello</span>
          </div>

          <div className="brain-list">
            {report.subscriptions.map((s) => (
              <div key={s.key} className="brain-row">
                <span className="brain-dot" data-state={s.overdue ? 'off' : s.increased ? 'configured' : 'connected'} />
                <div className="brain-row-main">
                  <div className="brain-row-title">
                    {s.label}
                    <span className="brain-tag" style={{ marginLeft: '0.5rem' }}>{s.cadence}</span>
                    {s.increased ? <span className="brain-tag" data-age="in attesa" style={{ marginLeft: '0.375rem' }}>aumentato</span> : null}
                    {s.overdue ? <span className="brain-tag" data-age="fermo" style={{ marginLeft: '0.375rem' }}>forse finito</span> : null}
                  </div>
                  <div className="brain-row-hint">
                    € {formatEuro(s.typicalCents)} a {s.cadence === 'mensile' ? 'mese' : 'addebito'} · € {formatEuro(s.yearlyCents)} all&rsquo;anno · {s.count} addebiti · ultimo {itDay(s.lastAt)}
                    {s.increased ? ` (€ ${formatEuro(s.lastCents)})` : ''}
                    {!s.overdue ? ` · prossimo atteso ${itDay(s.nextAt)}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
