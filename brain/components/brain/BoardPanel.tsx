'use client'

import { useEffect, useState } from 'react'
import ClaimCard from '@/components/brain/ClaimCard'
import type { Board, BoardClaim, Reply } from '@/lib/brain/board'
import { BOARD_ORDER, EXECUTIVES, type ExecutiveKey } from '@/lib/brain/executives'

/**
 * Il tavolo.
 *
 * In cima la chiusura di Grace — deciso, aperto, per te — perché è
 * quella che si legge in trenta secondi. Sotto, i cinque memo con le
 * repliche ricevute, obiezioni davanti: il disaccordo è il motivo per
 * cui il board esiste, e non si nasconde in fondo.
 */

export type StoredBoard = Board & { at?: string; text?: string; worthSending?: boolean }

const STANCE_LABEL: Record<Reply['stance'], string> = {
  accordo: 'd\'accordo',
  obiezione: 'obiezione',
  risposta: 'risponde',
  richiesta: 'chiede',
}
const STANCE_AGE: Record<Reply['stance'], string | undefined> = { obiezione: 'fermo', richiesta: 'in attesa', risposta: undefined, accordo: undefined }

function when(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function claim(c: BoardClaim) {
  return { text: c.text, unverified: c.unverified, sources: c.sources.map((s) => ({ ...s, source: s.source as never })) }
}

const nameOf = (k: string) => EXECUTIVES[k as ExecutiveKey]?.name ?? k

type SentInitiative = { key: string; executive: string; kind: string; text: string; at: string; channel?: string }

export default function BoardPanel({ initialBoard }: { initialBoard: StoredBoard | null }) {
  const [board, setBoard] = useState<StoredBoard | null>(initialBoard)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initiatives, setInitiatives] = useState<SentInitiative[] | null>(null)
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/brain/initiatives')
      .then((res) => (res.ok ? res.json() : { initiatives: [] }))
      .then((data) => {
        if (alive) setInitiatives(data.initiatives ?? [])
      })
      .catch(() => {
        if (alive) setInitiatives([])
      })
    return () => {
      alive = false
    }
  }, [])

  async function takePulse() {
    if (pulsing) return
    setPulsing(true)
    setError(null)
    try {
      const res = await fetch('/api/brain/initiatives', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Il polso è fallito.')
      else {
        const sent = (data.sent ?? []) as SentInitiative[]
        setInitiatives((prev) => [...sent.map((i) => ({ ...i, at: new Date().toISOString(), channel: data.channel })), ...(prev ?? [])])
      }
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setPulsing(false)
    }
  }

  async function convene() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/brain/board', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Il board non si è riunito.')
      else setBoard({ ...(data.board as StoredBoard), at: new Date().toISOString() })
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  const s = board?.synthesis ?? null

  return (
    <section>
      <div className="brain-actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="brain-btn brain-btn-primary" onClick={() => void convene()} disabled={busy}>
          {busy ? 'Il board si sta riunendo (un minuto o due)…' : board ? 'Riunisci il board adesso' : 'Riunisci il board'}
        </button>
        {board?.at || board?.generatedAt ? <span className="brain-meta">ultima riunione {when(board.at ?? board.generatedAt)}</span> : null}
      </div>

      <details className="brain-how">
        <summary>Come funziona</summary>
        <p className="brain-note">
          Cinque dirigenti leggono le loro scrivanie — calcolate, senza modello — scrivono un memo
          ciascuno in parallelo, poi leggono i memo degli altri e rispondono: accordo, obiezione,
          risposta. Grace chiude. <b>Ogni riga cita una fonte</b>, i memo compresi; un disaccordo non
          si scioglie nascondendolo: resta scritto, con i nomi. Si riunisce ogni mattina da solo, e
          quando lo chiedi.
        </p>
      </details>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      <div className="brain-section">
        <h2>
          Si sono fatti vivi{' '}
          <button type="button" className="brain-copy" onClick={() => void takePulse()} disabled={pulsing}>
            {pulsing ? 'controllo…' : 'polso adesso'}
          </button>
        </h2>
        <p className="brain-meta" style={{ marginBottom: '0.5rem' }}>
          Ogni mezz&rsquo;ora i dirigenti controllano se c&rsquo;è qualcosa da dirti adesso: un incontro fra
          due ore, una scadenza domani, un addebito senza fattura, una relazione che tace. Una cosa si
          dice una volta; al massimo due a testa e sei al giorno; di notte solo le urgenze.
        </p>
        {initiatives === null ? null : initiatives.length ? (
          <div className="brain-list">
            {initiatives.map((i) => (
              <div key={`${i.key}-${i.at}`} className="brain-row">
                <span className="brain-dot" data-state={i.kind === 'meeting' || i.kind === 'deadline' ? 'configured' : 'connected'} />
                <div className="brain-row-main">
                  <div className="brain-row-title" style={{ whiteSpace: 'pre-wrap' }}>{i.text.replace(/\*/g, '').replace(/_/g, '')}</div>
                  <div className="brain-row-hint">{when(i.at)}{i.channel ? ` · via ${i.channel}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="brain-empty">Niente negli ultimi sette giorni. Quando il polso è acceso, qui vedi cosa ti hanno scritto e quando.</p>
        )}
      </div>

      {!board ? (
        <p className="brain-empty" style={{ marginTop: '1rem' }}>
          Il board non si è ancora riunito. Premi il pulsante, oppure aspetta domattina.
        </p>
      ) : (
        <div className="brain-answer">
          {s ? (
            <>
              {s.decisioni.length ? (
                <div className="brain-section">
                  <h2>Il board ha deciso</h2>
                  <div className="brain-answer" style={{ marginTop: 0 }}>
                    {s.decisioni.map((c, i) => <ClaimCard key={i} claim={claim(c)} />)}
                  </div>
                </div>
              ) : null}
              {s.aperti.length ? (
                <div className="brain-section">
                  <h2>Resta aperto <span className="brain-tag" data-age="fermo">disaccordo</span></h2>
                  <div className="brain-answer" style={{ marginTop: 0 }}>
                    {s.aperti.map((c, i) => <ClaimCard key={i} claim={claim(c)} />)}
                  </div>
                </div>
              ) : null}
              {s.perTe.length ? (
                <div className="brain-section">
                  <h2>Per te</h2>
                  <div className="brain-answer" style={{ marginTop: 0 }}>
                    {s.perTe.map((c, i) => <ClaimCard key={i} claim={claim(c)} />)}
                  </div>
                </div>
              ) : null}
              {!s.decisioni.length && !s.aperti.length && !s.perTe.length ? (
                <p className="brain-empty">Il board non ha trovato niente da decidere. Succede quando la memoria è ancora vuota.</p>
              ) : null}
            </>
          ) : null}

          <div className="brain-section">
            <h2>Il tavolo</h2>
            {BOARD_ORDER.map((key) => {
              const exec = EXECUTIVES[key]
              const memo = board.memos.find((m) => m.executive === key)
              const received = board.replies
                .filter((r) => r.to === key)
                .sort((a, b) => (a.stance === 'obiezione' ? 0 : 1) - (b.stance === 'obiezione' ? 0 : 1))
              return (
                <div key={key} className="brain-section" style={{ marginTop: '1rem' }}>
                  <h3 style={{ margin: 0 }}>
                    {exec.name} <span className="brain-meta">· {exec.title}</span>
                  </h3>
                  {memo && (memo.punti.length || memo.richieste.length) ? (
                    <div className="brain-answer" style={{ marginTop: '0.5rem' }}>
                      {memo.punti.map((c, i) => <ClaimCard key={i} claim={claim(c)} />)}
                      {memo.richieste.map((r, i) => (
                        <div key={`r${i}`} className="brain-claim">
                          <span className="brain-tag" data-age="in attesa">chiede a {nameOf(r.a)}</span> {r.text}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="brain-meta" style={{ marginTop: '0.5rem' }}>Niente da segnalare dalla sua scrivania.</p>
                  )}
                  {received.length ? (
                    <div className="brain-open" style={{ marginTop: '0.5rem' }}>
                      <h3>Gli rispondono</h3>
                      <ul>
                        {received.map((r, i) => (
                          <li key={i}>
                            <span className="brain-tag" data-age={STANCE_AGE[r.stance]}>{nameOf(r.from)} · {STANCE_LABEL[r.stance]}</span> {r.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {memo?.dropped ? <p className="brain-meta">{memo.dropped} righe scartate per fonte mancante</p> : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
