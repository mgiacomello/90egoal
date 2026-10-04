'use client'

import { useState } from 'react'
import ClaimCard from '@/components/brain/ClaimCard'
import type { RadarReport } from '@/lib/brain/agents/radar'

/**
 * La scheda Radar.
 *
 * I segnali in cima, con l'impatto e l'orizzonte accanto; poi le
 * prospettive, che cominciano tutte con "Interpretazione:" perché lo
 * sono; poi cosa significa per te. In fondo, gli articoli che il
 * codice ha scelto e perché — così si vede da dove viene tutto.
 */

const PERIODS = [
  { label: '3 giorni', days: 3 },
  { label: '7 giorni', days: 7 },
  { label: '14 giorni', days: 14 },
]

const IMPACT_AGE: Record<string, string | undefined> = { alto: 'fermo', medio: 'in attesa', basso: undefined }

export default function RadarPanel() {
  const [days, setDays] = useState(7)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<RadarReport | null>(null)

  async function run(period: number) {
    if (busy) return
    setBusy(true)
    setError(null)
    setDays(period)
    try {
      const res = await fetch(`/api/brain/radar?days=${period}`)
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a leggere il radar.')
      else setReport(data as RadarReport)
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
          <button key={p.days} type="button" className="brain-chip" aria-pressed={days === p.days} onClick={() => void run(p.days)} disabled={busy}>
            {p.label}
          </button>
        ))}
        <button type="button" className="brain-btn brain-btn-primary" onClick={() => void run(days)} disabled={busy}>
          {busy ? 'Leggo gli articoli…' : 'Cosa sta cambiando'}
        </button>
      </div>

      <p className="brain-note">
        Gli articoli arrivano dai feed letti ogni notte (connettore <b>Web</b>, scheda Fonti). La
        selezione la fa il codice sul tuo profilo; il modello legge solo quelli e scrive segnali,
        prospettive e mosse — ogni riga cita l&rsquo;articolo. Un&rsquo;ipotesi comincia sempre con
        &ldquo;Interpretazione:&rdquo;.
      </p>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {report ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={report.segnali.length ? 'ok' : 'warn'}>
            <span className="brain-verdict-label">
              {report.segnali.length ? `${report.segnali.length} segnali` : 'niente di rilevante'}
            </span>
            <p>
              {report.offered.length} articoli selezionati su {report.examined} degli ultimi {report.days} giorni
              {report.model !== 'nessuno' ? ` · modello ${report.model}` : ''}
              {report.dropped ? ` · ${report.dropped} righe scartate per fonte mancante` : ''}
            </p>
            {!report.examined ? (
              <span className="brain-meta">Nessun articolo in memoria: scheda Fonti → Sincronizza tutto.</span>
            ) : null}
          </div>

          {report.segnali.length ? (
            <div className="brain-section">
              <h2>Segnali</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {report.segnali.map((c, i) => (
                  <div key={i}>
                    <div style={{ marginBottom: '0.25rem' }}>
                      <span className="brain-tag" data-age={IMPACT_AGE[c.impatto]}>impatto {c.impatto}</span>
                      {c.orizzonte ? <span className="brain-tag" style={{ marginLeft: '0.375rem' }}>{c.orizzonte}</span> : null}
                    </div>
                    <ClaimCard claim={c} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {report.prospettive.length ? (
            <div className="brain-section">
              <h2>Prospettive</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {report.prospettive.map((c, i) => <ClaimCard key={i} claim={c} />)}
              </div>
            </div>
          ) : null}

          {report.perTe.length ? (
            <div className="brain-section">
              <h2>Per te</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {report.perTe.map((c, i) => <ClaimCard key={i} claim={c} />)}
              </div>
            </div>
          ) : null}

          {report.offered.length ? (
            <div className="brain-section">
              <h2>Gli articoli scelti</h2>
              <div className="brain-list">
                {report.offered.map((a) => (
                  <div key={a.handle} className="brain-row">
                    <span className="brain-dot" data-state="connected" />
                    <div className="brain-row-main">
                      <div className="brain-row-title">
                        <span className="brain-meta">{a.handle}</span>{' '}
                        {a.url ? <a href={a.url} target="_blank" rel="noreferrer">{a.title}</a> : a.title}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
