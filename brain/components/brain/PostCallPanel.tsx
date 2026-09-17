'use client'

import { useEffect, useState } from 'react'
import ClaimCard from '@/components/brain/ClaimCard'
import type { CallDebrief, CallSummary } from '@/lib/brain/agents/postcall'

/**
 * La scheda Dopo la call.
 *
 * Apre sulle call vere che hanno lasciato qualcosa in Drive: non c'è
 * niente da incollare, si tocca la riunione e si legge. L'ordine è
 * quello che serve a chi ha appena chiuso la chiamata: **prima chi si
 * è preso cosa**, poi le decisioni, poi quello che è rimasto per aria.
 * La mail sta in fondo, pronta, e non parte da qui: si copia, o si
 * apre nel client di posta, e a mandarla è chi la legge.
 *
 * La quota di parlato sta in cima, piccola. In una call commerciale è
 * il numero che un coach guarderebbe per primo.
 */

function itDay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

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

export default function PostCallPanel() {
  const [calls, setCalls] = useState<CallSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<CallDebrief | null>(null)
  const [opened, setOpened] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/brain/postcall')
      .then((res) => (res.ok ? res.json() : { calls: [] }))
      .then((data) => {
        if (alive) setCalls(data.calls ?? [])
      })
      .catch(() => {
        if (alive) setCalls([])
      })
    return () => {
      alive = false
    }
  }, [])

  async function run(documentId: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    setReport(null)
    setOpened(null)
    try {
      const res = await fetch('/api/brain/postcall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a fare il debrief.')
      else setReport(data as CallDebrief)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  async function openMine() {
    if (!report) return
    const mine = report.impegni.filter((i) => i.mio)
    if (!mine.length) return
    try {
      const res = await fetch('/api/brain/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          texts: mine.map((i) => `${i.text}${i.entro ? ` — entro ${i.entro}` : ''} (call "${report.title}")`),
          citations: mine[0].sources.slice(0, 1).map((s) => ({
            source: s.source,
            title: s.title,
            occurredAt: s.occurredAt,
            url: s.url,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito ad aprire i punti.')
      else setOpened(`${mine.length} impegn${mine.length === 1 ? 'o' : 'i'} fra i punti aperti. Si chiudono dalla scheda Brief, a mano.`)
    } catch {
      setError('Connessione interrotta.')
    }
  }

  const mine = report?.impegni.filter((i) => i.mio) ?? []

  return (
    <section>
      <p className="brain-note" style={{ marginBottom: '1rem' }}>
        Le call arrivano da <b>Google Meet</b>: gli appunti di Gemini (o la trascrizione) finiscono
        in Drive, e Drive è già in memoria. Con gli appunti il debrief è <b>copiato per sezioni,
        senza modello</b>: ogni riga cita la sezione da cui viene. Con la trascrizione, ogni riga
        cita il tratto in cui la cosa è stata detta. La mail non parte da qui: la mandi tu.
      </p>

      <div className="brain-list">
        {(calls ?? []).map((c) => (
          <div key={c.key} className="brain-row">
            <span className="brain-dot" data-state={c.transcriptId ? 'connected' : 'configured'} />
            <div className="brain-row-main">
              <div className="brain-row-title">{c.title}</div>
              <div className="brain-meta" style={{ marginTop: '0.25rem' }}>
                {itDay(c.day)}
                {c.transcriptId ? ' · trascrizione' : ''}
                {c.notesId ? ' · appunti di Gemini' : ''}
              </div>
            </div>
            <button
              type="button"
              className="brain-btn"
              onClick={() => void run(c.transcriptId ?? c.notesId ?? '')}
              disabled={busy}
            >
              Debrief
            </button>
          </div>
        ))}
        {calls !== null && !calls.length ? (
          <p className="brain-empty">
            Nessuna call in memoria. In Google Meet attiva la trascrizione (o &ldquo;Prendi appunti
            con Gemini&rdquo;): il documento finisce in Drive e alla prossima sincronizzazione compare
            qui.
          </p>
        ) : null}
      </div>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}
      {busy ? <p className="brain-meta" style={{ marginTop: '1rem' }}>Leggo la trascrizione…</p> : null}

      {report ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={report.offered.length ? 'ok' : 'warn'}>
            <span className="brain-verdict-label">{report.title}</span>
            <p>
              {itDay(report.day)}
              {report.attendees.length ? ` · con ${report.attendees.join(', ')}` : ''}
              {report.calendar ? ' · trovata in agenda' : ''}
            </p>
            {report.speakers.length ? (
              <p className="brain-meta">
                ha parlato:{' '}
                {report.speakers.map((s) => `${s.speaker} ${Math.round(s.share * 100)}%`).join(' · ')}
              </p>
            ) : null}
            <span className="brain-meta">
              {report.offered.length} fonti lette ·{' '}
              {report.model === 'nessuno' ? 'senza modello' : `modello ${report.model}`}
              {report.coverage && report.coverage < 1 ? ` · letta solo il ${Math.round(report.coverage * 100)}% della trascrizione` : ''}
              {report.hadNotes && report.hadTranscript ? ' · con gli appunti di Gemini' : ''}
              {report.hadNotes && !report.hadTranscript ? ' · dagli appunti di Gemini' : ''}
              {report.dropped ? ` · ${report.dropped} righe scartate per fonte mancante` : ''}
            </span>
          </div>

          {report.reason ? <p className="brain-empty">{report.reason}</p> : null}

          {report.sintesi.length ? (
            <div className="brain-section">
              <h2>In due righe</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {report.sintesi.map((c, k) => (
                  <ClaimCard key={k} claim={c} />
                ))}
              </div>
            </div>
          ) : null}

          {report.impegni.length ? (
            <div className="brain-section">
              <h2>Chi si è preso cosa</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {report.impegni.map((i, k) => (
                  <ClaimCard
                    key={k}
                    claim={{
                      ...i,
                      text: `${i.mio ? 'Tu' : i.chi}: ${i.text}${i.entro ? ` — entro ${i.entro}` : ''}`,
                    }}
                  />
                ))}
              </div>
              {mine.length ? (
                <div className="brain-actions" style={{ marginTop: '0.75rem' }}>
                  <button type="button" className="brain-btn" onClick={() => void openMine()} disabled={Boolean(opened)}>
                    Metti i miei {mine.length === 1 ? 'impegno' : `${mine.length} impegni`} fra i punti aperti
                  </button>
                  {opened ? <span className="brain-meta">{opened}</span> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {report.decisioni.length ? (
            <div className="brain-section">
              <h2>Cosa è stato deciso</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {report.decisioni.map((c, k) => (
                  <ClaimCard key={k} claim={c} />
                ))}
              </div>
            </div>
          ) : null}

          {report.domande.length ? (
            <div className="brain-section">
              <h2>Rimasto per aria</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {report.domande.map((c, k) => (
                  <ClaimCard key={k} claim={c} />
                ))}
              </div>
            </div>
          ) : null}

          {report.openPoints.length ? (
            <div className="brain-open">
              <h3>Punti già aperti che c&rsquo;entrano</h3>
              <ul>
                {report.openPoints.map((p) => (
                  <li key={p.id}>{p.text}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {report.followUp ? (
            <div className="brain-section">
              <h2>
                La mail di follow-up <Copy text={`${report.followUp.subject}\n\n${report.followUp.text}`} />
              </h2>
              <p className="brain-meta" style={{ marginBottom: '0.5rem' }}>
                Formattata dalle righe qui sopra, non generata. Oggetto: <b>{report.followUp.subject}</b>
                {report.hadNotes && !report.hadTranscript
                  ? ' · Le righe vengono dagli appunti di Gemini: rileggile prima di mandare, tu c\'eri.'
                  : ''}
              </p>
              <pre className="brain-counter">{report.followUp.text}</pre>
              <div className="brain-actions" style={{ marginTop: '0.75rem' }}>
                <a
                  className="brain-btn"
                  href={`mailto:?subject=${encodeURIComponent(report.followUp.subject)}&body=${encodeURIComponent(report.followUp.text)}`}
                >
                  Apri nel client di posta
                </a>
              </div>
            </div>
          ) : null}

          {!report.reason && !report.impegni.length && !report.decisioni.length && !report.domande.length ? (
            <p className="brain-empty">
              La trascrizione non contiene decisioni, impegni o domande che reggano a una fonte.
              Meglio dirlo che inventare un riepilogo.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
