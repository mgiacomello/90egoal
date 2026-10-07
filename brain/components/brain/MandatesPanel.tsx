'use client'

import { useEffect, useState } from 'react'
import type { Mandate } from '@/lib/brain/lifecycle'

/**
 * I mandati: le cose che BRAIN ha in carico. La stessa lista che sul
 * telefono risponde a "mandati", con gli stessi tre gesti — ok, no,
 * fatto — e una riga per dire a BRAIN quello che gli diresti su
 * WhatsApp ("ricordami domani alle 9 di chiamare Verdi").
 */

const STATUS_LABEL: Record<Mandate['status'], string> = {
  proposed: 'aspetta il tuo ok',
  waiting: 'in attesa',
  approved: 'approvato',
  done: 'fatto',
  declined: 'lasciato stare',
  expired: 'scaduto',
}

function when(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function plain(text: string): string {
  return text.replace(/\*/g, '').replace(/_\[([A-Z0-9]{4})\]_/g, '[$1]').replace(/_/g, '')
}

export default function MandatesPanel() {
  const [open, setOpen] = useState<Mandate[] | null>(null)
  const [closed, setClosed] = useState<Mandate[]>([])
  const [busy, setBusy] = useState(false)
  const [say, setSay] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState(0)

  async function load(init?: RequestInit) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/brain/mandates', init)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Errore.')
      setOpen(data.open ?? [])
      setClosed(data.closed ?? [])
      setLoadedAt(Date.now())
      if (typeof data.reply === 'string') setReply(data.reply)
      return data
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    let alive = true
    fetch('/api/brain/mandates')
      .then((res) => (res.ok ? res.json() : { open: [], closed: [] }))
      .then((data) => {
        if (!alive) return
        setOpen(data.open ?? [])
        setClosed(data.closed ?? [])
        setLoadedAt(Date.now())
      })
      .catch(() => {
        if (alive) setOpen([])
      })
    return () => {
      alive = false
    }
  }, [])

  const post = (body: Record<string, unknown>) => load({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = say.trim()
    if (!text) return
    setSay('')
    await post({ action: 'say', text })
  }

  return (
    <div className="brain-section">
      <h2>
        I mandati{' '}
        <button type="button" className="brain-copy" onClick={() => void post({ action: 'scan' })} disabled={busy}>
          {busy ? 'controllo…' : 'cerca nelle mail adesso'}
        </button>
      </h2>
      <p className="brain-meta" style={{ marginBottom: '0.5rem' }}>
        Le cose che ho preso in carico: un volo di cui fare il check-in quando apre, un avviso da pagare
        entro una data, un invito che si scontra con l&rsquo;agenda, un promemoria. Ognuno ha un codice:
        sul telefono bastano <b>ok</b>, <b>no</b> e <b>fatto</b> seguiti dal codice. Niente parte a nome tuo.
      </p>

      <form onSubmit={submit} className="brain-actions" style={{ marginBottom: '0.75rem' }}>
        <input
          className="brain-field"
          style={{ flex: 1, minHeight: 0 }}
          placeholder='Come su WhatsApp: "ricordami domani alle 9 di chiamare Verdi", "fatto 7F2A", "mandati"'
          value={say}
          onChange={(e) => setSay(e.target.value)}
          disabled={busy}
        />
        <button type="submit" className="brain-btn" disabled={busy || !say.trim()}>Dillo</button>
      </form>
      {reply ? <pre className="brain-note" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{plain(reply)}</pre> : null}
      {error ? <p className="brain-error">{error}</p> : null}

      {open === null ? null : open.length ? (
        <div className="brain-list">
          {open.map((m) => (
            <div key={m.id} className="brain-row">
              <span className="brain-dot" data-state={m.status === 'proposed' ? 'configured' : 'connected'} />
              <div className="brain-row-main">
                <div className="brain-row-title">
                  {m.title} <span className="brain-tag">{m.code}</span>
                </div>
                <div className="brain-row-hint">
                  {STATUS_LABEL[m.status]}
                  {m.wakeAt && Date.parse(m.wakeAt) > loadedAt ? ` · mi faccio vivo il ${when(m.wakeAt)}` : ''}
                  {m.dueAt ? ` · entro ${when(m.dueAt)}` : ''}
                  {' · '}
                  <button type="button" className="brain-copy" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                    {expanded === m.id ? 'chiudi' : 'leggi'}
                  </button>
                  {m.status === 'proposed' ? (
                    <>
                      {' · '}
                      <button type="button" className="brain-copy" onClick={() => void post({ action: 'approve', id: m.id })} disabled={busy}>ok</button>
                      {' · '}
                      <button type="button" className="brain-copy" onClick={() => void post({ action: 'decline', id: m.id })} disabled={busy}>no</button>
                    </>
                  ) : null}
                  {' · '}
                  <button type="button" className="brain-copy" onClick={() => void post({ action: 'done', id: m.id })} disabled={busy}>fatto</button>
                </div>
                {expanded === m.id ? (
                  <pre className="brain-note" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', marginTop: '0.5rem' }}>
                    {plain(m.text)}
                    {m.citations.length ? `\n\nFonte: ${m.citations.map((c) => `${c.title} (${when(c.occurredAt)})`).join('; ')}` : ''}
                  </pre>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="brain-empty">Nessun mandato aperto. Nascono da soli dalle mail: un volo, un avviso di pagamento, un invito. Oppure scrivimi &ldquo;ricordami …&rdquo;.</p>
      )}

      {closed.length ? (
        <details style={{ marginTop: '0.75rem' }}>
          <summary className="brain-meta">Chiusi negli ultimi sette giorni ({closed.length})</summary>
          <div className="brain-list" style={{ marginTop: '0.5rem' }}>
            {closed.map((m) => (
              <div key={m.id} className="brain-row">
                <span className="brain-dot" />
                <div className="brain-row-main">
                  <div className="brain-row-title">{m.title}</div>
                  <div className="brain-row-hint">{STATUS_LABEL[m.status]} · {when(m.closedAt)}{m.note ? ` · ${m.note}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  )
}
