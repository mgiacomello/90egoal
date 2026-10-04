'use client'

import { useState } from 'react'
import type { SlotsReport } from '@/lib/brain/agents/slots'

/**
 * La scheda Appuntamenti.
 *
 * Tre finestre libere, in ora italiana, e la mail per proporle. Non
 * fissa niente e non scrive a nessuno: è la metà onesta di un
 * assistente che prende appuntamenti, quella che costa tempo.
 */

function Copy({ text }: { text: string }) {
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
      {done ? 'copiata' : 'copia'}
    </button>
  )
}

const DURATIONS = [30, 60, 90]

export default function SlotsPanel() {
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState(60)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<SlotsReport | null>(null)

  async function run(minutes = duration) {
    if (busy) return
    setBusy(true)
    setError(null)
    setDuration(minutes)
    try {
      const res = await fetch(`/api/brain/slots?days=10&duration=${minutes}&topic=${encodeURIComponent(topic)}`)
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a leggere l’agenda.')
      else setReport(data as SlotsReport)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <form
        className="brain-ask"
        onSubmit={(e) => {
          e.preventDefault()
          void run()
        }}
      >
        <input
          className="brain-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Di cosa si tratta? (va nella mail: «per la call sul contratto ti propongo…»)"
        />
        <div className="brain-actions">
          {DURATIONS.map((m) => (
            <button key={m} type="button" className="brain-chip" aria-pressed={duration === m} onClick={() => void run(m)} disabled={busy}>
              {m} min
            </button>
          ))}
          <button type="submit" className="brain-btn brain-btn-primary" disabled={busy}>
            {busy ? 'Guardo l’agenda…' : 'Trova tre finestre'}
          </button>
        </div>
      </form>

      <p className="brain-note" style={{ marginTop: '1rem' }}>
        Giorni lavorativi, 9–18 ora italiana, un quarto d&rsquo;ora di margine prima e dopo ogni
        impegno, una proposta al giorno, con preferenza per le 10–12 e le 15–17. <b>Non fissa
        niente</b>: la mail la mandi tu, e l&rsquo;evento lo crei tu quando l&rsquo;altro risponde.
      </p>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {report ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={report.slots.length ? 'ok' : 'warn'}>
            <span className="brain-verdict-label">
              {report.slots.length ? `${report.slots.length} finestre da ${report.durationMin} minuti` : 'agenda piena'}
            </span>
            <p>Nei prossimi {report.days} giorni, intorno a {report.busy} impegni già in agenda. Calcolato senza modello.</p>
          </div>

          {report.slots.length ? (
            <div className="brain-list">
              {report.slots.map((s) => (
                <div key={s.start} className="brain-row">
                  <span className="brain-dot" data-state="connected" />
                  <div className="brain-row-main">
                    <div className="brain-row-title">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="brain-empty">Nessuna finestra di {report.durationMin} minuti nei prossimi {report.days} giorni lavorativi. Prova una durata più corta.</p>
          )}

          {report.text ? (
            <div className="brain-section">
              <h2>La mail di proposta <Copy text={report.text} /></h2>
              <pre className="brain-counter">{report.text}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
