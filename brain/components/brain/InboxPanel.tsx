'use client'

import { useState } from 'react'
import ClaimCard from '@/components/brain/ClaimCard'
import type { Draft, InboxReport } from '@/lib/brain/agents/inbox'

/**
 * La scheda Posta.
 *
 * Una lista sola: i thread in cui l'ultima parola non è tua, dal più
 * pesante. "Pesante" è calcolato — ti hanno scritto direttamente, c'è
 * una domanda, sono passati N giorni — non giudicato. La bozza si
 * chiede per un thread alla volta, e non parte da qui.
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

export default function InboxPanel() {
  const [busy, setBusy] = useState(false)
  const [drafting, setDrafting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<InboxReport | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  async function run() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/brain/inbox?minDays=1')
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a leggere la posta.')
      else setReport(data as InboxReport)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  async function draft(documentId: string) {
    if (drafting) return
    setDrafting(documentId)
    setError(null)
    try {
      const res = await fetch('/api/brain/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a scrivere la bozza.')
      else setDrafts((d) => ({ ...d, [documentId]: data as Draft }))
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setDrafting(null)
    }
  }

  return (
    <section>
      <div className="brain-actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="brain-btn brain-btn-primary" onClick={() => void run()} disabled={busy}>
          {busy ? 'Leggo i thread…' : 'Chi aspetta me'}
        </button>
      </div>

      <details className="brain-how">
        <summary>Come funziona</summary>
        <p className="brain-note">
          Non è un riassunto della casella. È un fatto: <b>in questi thread l&rsquo;ultimo a scrivere
          non sei tu</b>. Calcolato dai messaggi, senza modello. La bozza, se la chiedi, cita i
          messaggi del thread e lascia fra parentesi quadre quello che deve decidere tu. Non parte da
          qui.
        </p>
      </details>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {report ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={report.rows.length ? 'warn' : 'ok'}>
            <span className="brain-verdict-label">
              {report.rows.length ? `${report.rows.length} thread aspettano te` : 'nessuno aspetta te'}
            </span>
            <p>Su {report.threads} thread e {report.examined} messaggi in memoria. Calcolato senza modello.</p>
          </div>

          <div className="brain-list">
            {report.rows.map((t) => {
              const d = drafts[t.documentId]
              return (
                <div key={t.threadId} className="brain-row" style={{ flexWrap: 'wrap' }}>
                  <span className="brain-dot" data-state={t.ageDays >= 7 ? 'off' : t.direct ? 'configured' : 'connected'} />
                  <div className="brain-row-main">
                    <div className="brain-row-title">
                      {t.url ? <a href={t.url} target="_blank" rel="noreferrer">{t.title}</a> : t.title}
                      <span className="brain-tag" data-age={t.ageDays >= 7 ? 'fermo' : t.ageDays >= 3 ? 'in attesa' : undefined} style={{ marginLeft: '0.5rem' }}>
                        da {t.ageDays} giorn{t.ageDays === 1 ? 'o' : 'i'}
                      </span>
                      {t.asks ? <span className="brain-tag" style={{ marginLeft: '0.375rem' }}>chiede qualcosa</span> : null}
                      {!t.direct ? <span className="brain-tag" style={{ marginLeft: '0.375rem' }}>in copia</span> : null}
                    </div>
                    <div className="brain-row-hint">
                      {t.from} · {t.messages} messaggi{t.messages === 1 ? 'o' : ''} nel thread
                    </div>
                  </div>
                  <button type="button" className="brain-btn" onClick={() => void draft(t.documentId)} disabled={Boolean(drafting) || Boolean(d)}>
                    {drafting === t.documentId ? 'Scrivo…' : d ? 'Bozza pronta' : 'Bozza'}
                  </button>
                  {d ? (
                    <div style={{ flexBasis: '100%', marginTop: '0.75rem' }}>
                      <p className="brain-meta" style={{ marginBottom: '0.5rem' }}>
                        A: {d.to} · Oggetto: <b>{d.subject}</b> · modello {d.model}
                        {d.dropped ? ` · ${d.dropped} paragraf${d.dropped === 1 ? 'o scartato' : 'i scartati'} per fonte mancante` : ''}
                        {' '}<Copy text={d.text} />
                      </p>
                      {d.paragrafi.map((c, i) => (
                        <ClaimCard key={i} claim={c} />
                      ))}
                      {!d.paragrafi.length ? <p className="brain-empty">Nessun paragrafo ha retto a una fonte: meglio scriverla a mano.</p> : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
            {!report.rows.length ? <p className="brain-empty">Hai risposto a tutti. Succede di rado: goditelo.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
