'use client'

import { useState } from 'react'
import type { DeadlinesReport } from '@/lib/brain/agents/deadlines'
import { CHANNEL_LABEL } from '@/lib/brain/types'

/**
 * La scheda Scadenze.
 *
 * Una lista per data, dalla più vicina. Le scadute da poco stanno in
 * cima e in rosso, perché una scadenza mancata ieri è la riga più
 * importante della pagina. Sotto ogni data, la frase del documento da
 * cui viene: per le date calcolate anche il calcolo, per esteso —
 * il giorno esatto lo decide il contratto, e chi legge deve poterlo
 * controllare senza aprire niente.
 */

const PERIODS = [
  { label: '30 giorni', days: 30 },
  { label: '120 giorni', days: 120 },
  { label: 'un anno', days: 365 },
]

const TONE: Record<string, string> = { scaduta: 'off', oggi: 'off', settimana: 'configured', mese: 'connected', oltre: 'connected' }
const URGENCY_LABEL: Record<string, string> = {
  scaduta: 'scaduta', oggi: 'oggi', settimana: 'questa settimana', mese: 'entro un mese', oltre: 'più avanti',
}

function itDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function DeadlinesPanel() {
  const [days, setDays] = useState(120)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<DeadlinesReport | null>(null)

  async function run(period: number) {
    if (busy) return
    setBusy(true)
    setError(null)
    setDays(period)
    try {
      const res = await fetch(`/api/brain/deadlines?days=${period}`)
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a leggere le scadenze.')
      else setReport(data as DeadlinesReport)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  const overdue = report?.rows.filter((r) => r.urgency === 'scaduta' || r.urgency === 'oggi').length ?? 0

  return (
    <section>
      <div className="brain-actions" style={{ marginBottom: '1rem' }}>
        {PERIODS.map((p) => (
          <button key={p.days} type="button" className="brain-chip" aria-pressed={days === p.days} onClick={() => void run(p.days)} disabled={busy}>
            {p.label}
          </button>
        ))}
        <button type="button" className="brain-btn brain-btn-primary" onClick={() => void run(days)} disabled={busy}>
          {busy ? 'Leggo le date…' : 'Entro quando'}
        </button>
      </div>

      <p className="brain-note">
        Questo agente <b>non usa nessun modello</b>. Una data si legge e una durata si somma; un
        modello che &ldquo;stima&rdquo; una scadenza è la cosa più pericolosa da mettere davanti a un
        avvocato. Per le date calcolate il calcolo è scritto per esteso: <b>il giorno esatto lo
        decide il contratto</b>, controllalo sulla frase.
      </p>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {report ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={overdue ? 'warn' : 'ok'}>
            <span className="brain-verdict-label">
              {report.rows.length
                ? `${report.rows.length} scadenz${report.rows.length === 1 ? 'a' : 'e'} nei prossimi ${report.horizonDays} giorni`
                : 'nessuna scadenza trovata'}
            </span>
            <p>
              {overdue ? `${overdue} già scadut${overdue === 1 ? 'a' : 'e'} o in scadenza oggi. ` : ''}
              Lette su {report.examined} documenti in memoria (Drive, posta, note). Calcolato senza modello.
            </p>
          </div>

          <div className="brain-list">
            {report.rows.map((r, i) => (
              <div key={`${r.documentId}-${r.kind}-${r.date}-${i}`} className="brain-row">
                <span className="brain-dot" data-state={TONE[r.urgency]} />
                <div className="brain-row-main">
                  <div className="brain-row-title">
                    {itDay(r.date)} · {r.label}
                    <span className="brain-tag" data-age={r.urgency === 'scaduta' ? 'fermo' : r.urgency === 'settimana' || r.urgency === 'oggi' ? 'in attesa' : undefined} style={{ marginLeft: '0.5rem' }}>
                      {URGENCY_LABEL[r.urgency]}
                    </span>
                  </div>
                  <div className="brain-row-hint">
                    {CHANNEL_LABEL[r.source]} · {r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : r.title}
                  </div>
                  <div className="brain-quote" style={{ marginTop: '0.375rem' }}>
                    <span className="brain-quote-mark">“</span>{r.quote}
                  </div>
                </div>
              </div>
            ))}
            {!report.rows.length ? (
              <p className="brain-empty">
                Nessuna frase con una data e una parola che la renda un termine. Se sai che una
                scadenza c&rsquo;è, il documento probabilmente non è ancora in memoria.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
