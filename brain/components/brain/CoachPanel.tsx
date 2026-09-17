'use client'

import { useState } from 'react'
import ClaimCard from '@/components/brain/ClaimCard'
import type { CoachReport } from '@/lib/brain/agents/coach'

/**
 * La scheda Coach.
 *
 * La prima cosa che si legge non è il consiglio: sono i numeri, in tre
 * tessere, con la direzione accanto. Sono calcolati dal codice e non
 * passano dal modello — e per questo stanno *sopra* alle frasi, non
 * sotto. Poi i giorni peggiori con quello che c'era in agenda il giorno
 * prima, che è il gesto più utile di un coach umano. Solo dopo, il
 * consiglio.
 *
 * E la riga che non si negozia: non è un parere medico. Sta in cima,
 * non in fondo in corpo piccolo.
 */

const TREND_MARK: Record<string, string> = {
  'in miglioramento': '↑',
  stabile: '→',
  'in peggioramento': '↓',
}

const PERIODS = [
  { label: '14 giorni', days: 14 },
  { label: '30 giorni', days: 30 },
  { label: '90 giorni', days: 90 },
]

function n(v: number | null): string {
  return v === null ? '—' : String(v).replace('.', ',')
}

export default function CoachPanel() {
  const [days, setDays] = useState(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<CoachReport | null>(null)

  async function run(period: number) {
    if (busy) return
    setBusy(true)
    setError(null)
    setDays(period)
    try {
      const res = await fetch(`/api/brain/coach?days=${period}`)
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a leggere i dati.')
      else setReport(data as CoachReport)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="brain-auto" data-tone="warn">
        <b>Non è un parere medico.</b> Sono i numeri di un anello, messi accanto alla tua agenda.
        Se qualcosa qui ti preoccupa, la persona giusta con cui parlarne è il tuo medico, non
        questa scheda.
      </div>

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
          {busy ? 'Leggo l’anello…' : 'Guarda come sto'}
        </button>
      </div>

      {error ? <p className="brain-error">{error}</p> : null}

      {report ? (
        <div className="brain-answer">
          {!report.summary.days ? (
            <p className="brain-empty">
              Nessun dato dell&rsquo;anello in questo periodo. Collega Oura nella scheda Fonti e
              sincronizza.
            </p>
          ) : (
            <>
              <div className="brain-tiles">
                {report.summary.metrics.map((m) => (
                  <div key={m.metric} className="brain-tile" data-trend={m.trend}>
                    <div className="brain-tile-label">{m.label}</div>
                    <div className="brain-tile-value">
                      {n(m.average)}
                      <span className="brain-tile-mark">{TREND_MARK[m.trend]}</span>
                    </div>
                    <div className="brain-meta">
                      ultimi 7: {n(m.recent)} · prima: {n(m.earlier)} · {m.samples} giorni
                    </div>
                  </div>
                ))}
              </div>
              <p className="brain-meta" style={{ marginTop: '-0.25rem' }}>
                dal {report.summary.from} al {report.summary.to} · calcolato senza modello
              </p>

              {report.correlations.length ? (
                <div className="brain-section">
                  <h2>I giorni peggiori, e cosa c&rsquo;era il giorno prima</h2>
                  <div className="brain-list">
                    {report.correlations.map((c) => (
                      <div key={c.day} className="brain-row">
                        <span className="brain-dot" data-state={c.before?.lateEnd ? 'configured' : 'off'} />
                        <div className="brain-row-main">
                          <div className="brain-row-title">
                            {c.day} · prontezza {n(c.readiness)}
                          </div>
                          <div className="brain-row-hint">
                            {c.before
                              ? `Il giorno prima: ${c.before.events.join(' · ')}${
                                  c.before.lateEnd ? ' — con un impegno di sera' : ''
                                }`
                              : 'Il giorno prima: niente in agenda.'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="brain-note" style={{ marginTop: '0.75rem' }}>
                    Non è statistica: è il gesto di guardare due fogli affiancati. A decidere se è un
                    pattern sei tu.
                  </p>
                </div>
              ) : null}

              {report.osservazioni.length ? (
                <div className="brain-section">
                  <h2>Cosa dicono i numeri</h2>
                  <div className="brain-answer" style={{ marginTop: 0 }}>
                    {report.osservazioni.map((c, i) => (
                      <ClaimCard key={i} claim={c} />
                    ))}
                  </div>
                </div>
              ) : null}

              {report.consigli.length ? (
                <div className="brain-section">
                  <h2>Da provare questa settimana</h2>
                  <div className="brain-answer" style={{ marginTop: 0 }}>
                    {report.consigli.map((c, i) => (
                      <ClaimCard key={i} claim={c} />
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="brain-meta">
                modello {report.model}
                {report.dropped ? ` · ${report.dropped} righe scartate per fonte mancante` : ''}
                {report.healthDocuments ? ` · ${report.healthDocuments} documenti di salute in memoria` : ''}
              </p>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
