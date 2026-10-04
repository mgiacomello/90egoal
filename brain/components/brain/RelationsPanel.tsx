'use client'

import { useState } from 'react'
import type { RelationRow, RelationsReport } from '@/lib/brain/agents/relations'
import { CHANNEL_LABEL } from '@/lib/brain/types'

/**
 * La scheda Relazioni.
 *
 * Prima chi si sta raffreddando, perché è la lista su cui si può fare
 * qualcosa oggi. Poi chi senti di più, che è lo specchio: dove sta
 * andando il tuo tempo. Ogni riga porta gli ultimi documenti in cui la
 * persona compare, così "non lo sento da 40 giorni" si verifica in un
 * tocco.
 */

function itDay(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function Row({ r, tone }: { r: RelationRow; tone: 'off' | 'connected' }) {
  return (
    <div className="brain-row">
      <span className="brain-dot" data-state={tone} />
      <div className="brain-row-main">
        <div className="brain-row-title">
          {r.label}
          <span className="brain-tag" data-age={r.cooling ? 'fermo' : undefined} style={{ marginLeft: '0.5rem' }}>
            silenzio da {r.silenceDays} giorni
          </span>
        </div>
        <div className="brain-row-hint">
          {r.touches} contatti{r.rhythmDays ? ` · di solito ogni ${r.rhythmDays} giorni` : ''} · ultimo {itDay(r.lastAt)}
        </div>
        <div className="brain-meta" style={{ marginTop: '0.25rem' }}>
          {r.recent.map((d, i) => (
            <span key={d.id}>
              {i ? ' · ' : ''}
              {CHANNEL_LABEL[d.source]} {itDay(d.occurredAt)}{' '}
              {d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.title}</a> : d.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function RelationsPanel() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<RelationsReport | null>(null)

  async function run() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/brain/relations')
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a leggere le relazioni.')
      else setReport(data as RelationsReport)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="brain-actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="brain-btn brain-btn-primary" onClick={() => void run()} disabled={busy}>
          {busy ? 'Conto i contatti…' : 'Chi si sta raffreddando'}
        </button>
      </div>

      <p className="brain-note">
        Il CRM che non si compila. Chi compare nelle mail e negli incontri, con che ritmo, e da
        quanto tace. <b>Si raffredda</b> chi aveva un ritmo e ora tace da almeno tre settimane e
        più del doppio del solito. Le organizzazioni si riconoscono dal dominio; le persone con una
        mail generica restano persone. Senza modello.
      </p>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {report ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={report.cooling.length ? 'warn' : 'ok'}>
            <span className="brain-verdict-label">
              {report.cooling.length ? `${report.cooling.length} relazion${report.cooling.length === 1 ? 'e' : 'i'} si st${report.cooling.length === 1 ? 'a' : 'anno'} raffreddando` : 'nessuna relazione si sta raffreddando'}
            </span>
            <p>{report.relations} relazioni su {report.examined} fra mail e incontri in memoria. Calcolato senza modello.</p>
          </div>

          {report.cooling.length ? (
            <div className="brain-section">
              <h2>Da risentire</h2>
              <div className="brain-list">
                {report.cooling.map((r) => <Row key={r.key} r={r} tone="off" />)}
              </div>
            </div>
          ) : null}

          {report.active.length ? (
            <div className="brain-section">
              <h2>Chi senti di più</h2>
              <div className="brain-list">
                {report.active.map((r) => <Row key={r.key} r={r} tone="connected" />)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
