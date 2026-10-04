'use client'

import { useState } from 'react'
import ClaimCard from '@/components/brain/ClaimCard'
import type { TrainingReport } from '@/lib/brain/agents/training'

/**
 * La scheda Allenamento.
 *
 * Il verdetto in cima, con le sue ragioni: è calcolato, e per questo
 * sta sopra alle frasi del modello. Poi i numeri in tessere, poi le
 * settimane, e solo in fondo il consiglio. La riga "non è un parere
 * medico" sta in testa, come nel Coach.
 */

const PERIODS = [
  { label: '2 settimane', days: 14 },
  { label: '4 settimane', days: 28 },
  { label: '8 settimane', days: 56 },
]

const TREND_MARK: Record<string, string> = { 'in miglioramento': '↑', stabile: '→', 'in peggioramento': '↓' }

function n(v: number | null): string {
  return v === null ? '—' : String(v).replace('.', ',')
}

function itDay(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function TrainingPanel() {
  const [days, setDays] = useState(28)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<TrainingReport | null>(null)

  async function run(period: number) {
    if (busy) return
    setBusy(true)
    setError(null)
    setDays(period)
    try {
      const res = await fetch(`/api/brain/training?days=${period}`)
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a leggere gli allenamenti.')
      else setReport(data as TrainingReport)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  const s = report?.summary

  return (
    <section>
      <div className="brain-auto" data-tone="warn">
        <b>Non è un parere medico, né un piano d&rsquo;allenamento.</b> Sono i numeri dell&rsquo;anello messi in
        fila con soglie di buon senso. Se qualcosa ti preoccupa, parlane con il tuo medico.
      </div>

      <div className="brain-actions" style={{ marginBottom: '1rem' }}>
        {PERIODS.map((p) => (
          <button key={p.days} type="button" className="brain-chip" aria-pressed={days === p.days} onClick={() => void run(p.days)} disabled={busy}>
            {p.label}
          </button>
        ))}
        <button type="button" className="brain-btn brain-btn-primary" onClick={() => void run(days)} disabled={busy}>
          {busy ? 'Leggo l’anello…' : 'Sto facendo sport bene?'}
        </button>
      </div>

      {error ? <p className="brain-error">{error}</p> : null}

      {report && s ? (
        <div className="brain-answer">
          {!s.sessions ? (
            <p className="brain-empty">
              Nessuna seduta registrata dall&rsquo;anello in questo periodo. Oura registra gli allenamenti da solo
              o dall&rsquo;app; dopo la prossima sincronizzazione compaiono qui.
            </p>
          ) : (
            <>
              <div className="brain-verdict" data-tone={s.verdict.ok ? 'ok' : 'warn'}>
                <span className="brain-verdict-label">{s.verdict.ok ? 'stai facendo bene' : 'qualcosa da cambiare'}</span>
                <p>
                  {s.sessions} sedute in {s.days} giorni, {s.minutes} minuti; {n(s.perWeek)} a settimana sulle settimane complete.
                </p>
                {s.verdict.warnings.length ? (
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
                    {s.verdict.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
                  </ul>
                ) : null}
                {s.verdict.good.length ? (
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
                    {s.verdict.good.map((g, i) => <li key={i}>✓ {g}</li>)}
                  </ul>
                ) : null}
                <span className="brain-meta">verdetto calcolato senza modello</span>
              </div>

              <div className="brain-tiles">
                <div className="brain-tile">
                  <div className="brain-tile-label">mix</div>
                  <div className="brain-tile-value" style={{ fontSize: '1.25rem' }}>
                    {s.mix.easy} · {s.mix.moderate} · {s.mix.hard}
                  </div>
                  <div className="brain-meta">facili · moderate · dure</div>
                </div>
                <div className="brain-tile" data-trend={s.hrvTrend}>
                  <div className="brain-tile-label">HRV</div>
                  <div className="brain-tile-value">
                    <span className="brain-tile-mark">{TREND_MARK[s.hrvTrend]}</span>
                  </div>
                  <div className="brain-meta">{s.hrvTrend}</div>
                </div>
                <div className="brain-tile" data-trend={s.restingHrTrend}>
                  <div className="brain-tile-label">frequenza a riposo</div>
                  <div className="brain-tile-value">
                    <span className="brain-tile-mark">{TREND_MARK[s.restingHrTrend]}</span>
                  </div>
                  <div className="brain-meta">{s.restingHrTrend}</div>
                </div>
              </div>
              <p className="brain-meta" style={{ marginTop: '-0.25rem' }}>
                prontezza il giorno dopo una seduta dura {n(s.recovery.afterHard)} contro {n(s.recovery.baseline)} ·
                sonno la notte dopo {n(s.sleepAfter.afterTraining)} contro {n(s.sleepAfter.otherNights)} ·
                al massimo {s.longestStreak} giorni di fila
              </p>

              <div className="brain-section">
                <h2>Le settimane</h2>
                <div className="brain-list">
                  {s.weeks.map((w) => (
                    <div key={w.week} className="brain-row">
                      <span className="brain-dot" data-state={w.sessions >= 3 ? 'connected' : w.sessions ? 'configured' : 'off'} />
                      <div className="brain-row-main">
                        <div className="brain-row-title">settimana dal {itDay(w.week)}</div>
                        <div className="brain-row-hint">
                          {w.sessions} sedute · {w.minutes} min · {w.hard} dure{w.days.length ? ` · ${w.days.map((d) => d.slice(8)).join(', ')}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {report.osservazioni.length ? (
                <div className="brain-section">
                  <h2>Cosa dicono i numeri</h2>
                  <div className="brain-answer" style={{ marginTop: 0 }}>
                    {report.osservazioni.map((c, i) => <ClaimCard key={i} claim={c} />)}
                  </div>
                </div>
              ) : null}
              {report.consigli.length ? (
                <div className="brain-section">
                  <h2>Da cambiare la settimana prossima</h2>
                  <div className="brain-answer" style={{ marginTop: 0 }}>
                    {report.consigli.map((c, i) => <ClaimCard key={i} claim={c} />)}
                  </div>
                </div>
              ) : null}
              <p className="brain-meta">
                modello {report.model}
                {report.dropped ? ` · ${report.dropped} righe scartate per fonte mancante` : ''}
              </p>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
