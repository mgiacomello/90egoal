'use client'

import { useEffect, useState } from 'react'
import ClaimCard from '@/components/brain/ClaimCard'
import type { MeetingBrief } from '@/lib/brain/agents/meeting'

/**
 * La scheda Incontro.
 *
 * Apre sugli appuntamenti veri dei prossimi giorni, non su un campo
 * vuoto: chi ha una riunione fra dieci minuti non ha voglia di
 * descriverla, vuole toccarla e leggere.
 *
 * L'ordine delle sezioni è una scelta, non una lista: **prima cosa è
 * rimasto in sospeso**, poi i punti, poi i fatti da avere in testa.
 * Un'agenda che riassume quello che vi siete detti è un riassunto; una
 * che dice cosa avete lasciato aperto è una preparazione.
 */

type CalendarEvent = {
  id: string
  title: string
  occurredAt: string
  participants: string[]
}

function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function daysSince(iso: string): number {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

export default function MeetingPanel() {
  const [events, setEvents] = useState<CalendarEvent[] | null>(null)
  const [who, setWho] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [brief, setBrief] = useState<MeetingBrief | null>(null)

  // Il calendario è un sistema esterno da cui ci si mette in ascolto una
  // volta all'apertura: è esattamente il lavoro di un effetto, e la
  // setState sta nella callback, non nel corpo.
  useEffect(() => {
    let alive = true
    fetch('/api/brain/meeting')
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data) => {
        if (alive) setEvents(data.events ?? [])
      })
      .catch(() => {
        if (alive) setEvents([])
      })
    return () => {
      alive = false
    }
  }, [])

  async function prepare(payload: { eventId?: string; who?: string }) {
    if (busy) return
    setBusy(true)
    setError(null)
    setBrief(null)
    try {
      const res = await fetch('/api/brain/meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a preparare l’incontro.')
      else setBrief(data as MeetingBrief)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <p className="brain-note" style={{ marginBottom: '1rem' }}>
        L&rsquo;agenda si costruisce da <b>quello che è già stato detto</b>. Il recupero parte da
        <b> chi</b>, non da cosa: i partecipanti sono un elenco esatto di indirizzi, non una ricerca
        per nome — così &ldquo;Bianchi&rdquo; non tira dentro anche il fornitore omonimo.
      </p>

      <div className="brain-list">
        {(events ?? []).map((e) => (
          <div key={e.id} className="brain-row">
            <span className="brain-dot" data-state="connected" />
            <div className="brain-row-main">
              <div className="brain-row-title">{e.title || '(evento senza titolo)'}</div>
              <div className="brain-meta" style={{ marginTop: '0.25rem' }}>
                {when(e.occurredAt)}
                {e.participants.length ? ` · ${e.participants.length} partecipanti` : ' · nessun partecipante'}
              </div>
            </div>
            <button
              type="button"
              className="brain-btn"
              onClick={() => void prepare({ eventId: e.id })}
              disabled={busy}
            >
              Preparami
            </button>
          </div>
        ))}
        {events !== null && !events.length ? (
          <p className="brain-empty">
            Nessun appuntamento nei prossimi 14 giorni. Collega il calendario nella scheda Fonti, o
            scrivi qui sotto con chi devi vederti.
          </p>
        ) : null}
      </div>

      <div className="brain-section">
        <h2>Oppure: con chi devi vederti</h2>
        <form
          className="brain-ask"
          onSubmit={(e) => {
            e.preventDefault()
            void prepare({ who })
          }}
        >
          <input
            className="brain-input"
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Nome e cognome, oppure l&#39;indirizzo email. L&#39;indirizzo è più preciso."
          />
          <div className="brain-actions">
            <button type="submit" className="brain-btn brain-btn-primary" disabled={busy || !who.trim()}>
              {busy ? 'Sto leggendo la memoria…' : 'Preparami'}
            </button>
          </div>
        </form>
      </div>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {brief ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={brief.found ? 'ok' : 'warn'}>
            <span className="brain-verdict-label">{brief.title}</span>
            <p>
              {brief.people.length ? `Con ${brief.people.join(', ')}. ` : ''}
              {brief.found
                ? `${brief.found} document${brief.found === 1 ? 'o' : 'i'} in memoria su queste persone.`
                : 'In memoria non c’è niente su queste persone.'}
            </p>
            <span className="brain-meta">
              {brief.offered.length} fonti lette · modello {brief.model}
              {brief.dropped ? ` · ${brief.dropped} righe scartate per fonte mancante` : ''}
            </span>
          </div>

          {brief.openPoints.length ? (
            <div className="brain-open">
              <h3>Punti aperti con queste persone</h3>
              <ul>
                {brief.openPoints.map((p) => (
                  <li key={p.id}>
                    {p.text}{' '}
                    <span className="brain-meta">· da {daysSince(p.openedAt)} giorni</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {brief.sospesi.length ? (
            <div className="brain-section">
              <h2>Cosa è rimasto in sospeso</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {brief.sospesi.map((c, i) => (
                  <ClaimCard key={i} claim={c} />
                ))}
              </div>
            </div>
          ) : null}

          {brief.punti.length ? (
            <div className="brain-section">
              <h2>Punti da toccare</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {brief.punti.map((c, i) => (
                  <ClaimCard key={i} claim={c} />
                ))}
              </div>
            </div>
          ) : null}

          {brief.daSapere.length ? (
            <div className="brain-section">
              <h2>Da avere in testa entrando</h2>
              <div className="brain-answer" style={{ marginTop: 0 }}>
                {brief.daSapere.map((c, i) => (
                  <ClaimCard key={i} claim={c} />
                ))}
              </div>
            </div>
          ) : null}

          {!brief.sospesi.length && !brief.punti.length && !brief.daSapere.length ? (
            <p className="brain-empty">
              Le fonti trovate non dicono niente di utile per questo incontro. Meglio dirlo che
              riempire un&rsquo;agenda con quello che c&rsquo;è.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
