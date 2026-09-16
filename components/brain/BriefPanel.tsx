'use client'

import { useCallback, useState } from 'react'
import ClaimCard from '@/components/brain/ClaimCard'
import type { BriefOpenPoint } from '@/lib/brain/agents/brief'
import { formatEuro } from '@/lib/brain/reconcile'
import { CHANNEL_LABEL, type SourceKey, type VerifiedClaim } from '@/lib/brain/types'

/**
 * La scheda brief.
 *
 * È la prima che si apre, e non per gusto: è l'unica parte del prodotto
 * che non richiede di sapere cosa chiedere. Il brief è già scritto —
 * lo ha fatto il cron stanotte — quindi aprire la console non costa
 * una chiamata al modello, e soprattutto quello che leggi è *quello*,
 * non una versione diversa riscritta perché hai ricaricato la pagina.
 *
 * I punti aperti stanno sotto e portano la loro età. Il numero dei
 * punti conta poco; da quanto ce li hai conta molto.
 */

type StoredClaim = {
  text: string
  trust: VerifiedClaim['trust']
  unverified: string[]
  sources: { handle: string; source: SourceKey; title: string; occurredAt: string; url: string | null }[]
}

type StoredBrief = {
  at?: string
  generatedAt?: string
  oggi?: StoredClaim[]
  novita?: StoredClaim[]
  conto?: { missing: number; missingCents: number; resolvable: number } | null
  dropped?: number
  model?: string
}

type Props = {
  initialBrief: StoredBrief | null
  initialPoints: BriefOpenPoint[]
}

const AGE_LABEL: Record<BriefOpenPoint['age'], string> = {
  nuovo: 'nuovo',
  'in attesa': 'in attesa',
  fermo: 'fermo',
}

function when(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('it-IT', {
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

export default function BriefPanel({ initialBrief, initialPoints }: Props) {
  const [brief, setBrief] = useState<StoredBrief | null>(initialBrief)
  const [points, setPoints] = useState<BriefOpenPoint[]>(initialPoints)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  const regenerate = useCallback(
    async (deliver = false) => {
      if (busy) return
      setBusy(true)
      setError(null)
      setSent(null)
      try {
        const res = await fetch(`/api/brain/brief${deliver ? '?deliver=1' : ''}`, { method: 'POST' })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Non sono riuscito a scrivere il brief.')
          return
        }
        setBrief(data.brief ?? null)
        setPoints(data.puntiAperti ?? [])

        if (deliver) {
          if (!data.deliveryConfigured) {
            setSent('Nessun canale configurato: servono RESEND_API_KEY e BRAIN_MAIL_FROM, oppure BRAIN_WEBHOOK_URL.')
          } else {
            const results = (data.delivery?.results ?? []) as { channel: string; ok: boolean; detail: string }[]
            setSent(results.map((r) => `${r.channel}: ${r.ok ? r.detail : `errore — ${r.detail}`}`).join(' · '))
          }
        }
      } catch {
        setError('Connessione interrotta.')
      } finally {
        setBusy(false)
      }
    },
    [busy]
  )

  async function act(id: string, action: 'close' | 'reopen') {
    const res = await fetch('/api/brain/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    })
    if (!res.ok) return
    // La risposta torna i punti ancora aperti: l'età la ricalcoliamo qui.
    setPoints((current) => current.filter((p) => p.id !== id))
  }

  const oggi = brief?.oggi ?? []
  const novita = brief?.novita ?? []

  return (
    <section>
      <div className="brain-auto">
        {brief ? (
          <>
            <b>Brief del {when(brief.at ?? brief.generatedAt)}</b> · scritto dalla sincronizzazione
            notturna. {brief.dropped
              ? `${brief.dropped} rig${brief.dropped === 1 ? 'a scartata' : 'he scartate'} per fonte mancante. `
              : ''}
            Non si riscrive da solo quando ricarichi: quello che leggi è quello di stanotte.
          </>
        ) : (
          <>
            <b>Nessun brief ancora.</b> Lo scrive il cron ogni notte dopo la sincronizzazione. Se hai
            appena installato, premi <i>Scrivilo adesso</i>.
          </>
        )}
      </div>

      <div className="brain-actions" style={{ marginBottom: '1.25rem' }}>
        <button type="button" className="brain-btn" onClick={() => void regenerate(false)} disabled={busy}>
          {busy ? 'Sto leggendo la memoria…' : brief ? 'Riscrivilo adesso' : 'Scrivilo adesso'}
        </button>
        <button type="button" className="brain-btn" onClick={() => void regenerate(true)} disabled={busy}>
          Provalo via mail
        </button>
        {brief?.model ? <span className="brain-meta">modello {brief.model}</span> : null}
      </div>

      {error ? <p className="brain-error">{error}</p> : null}
      {sent ? <p className="brain-note">{sent}</p> : null}

      {brief?.conto && brief.conto.missing > 0 ? (
        <div className="brain-verdict" data-tone="warn" style={{ marginBottom: '1.25rem' }}>
          <span className="brain-verdict-label">conto</span>
          <p>
            {brief.conto.missing} pagament{brief.conto.missing === 1 ? 'o' : 'i'} senza
            giustificativo, per € {formatEuro(brief.conto.missingCents)}.
            {brief.conto.resolvable
              ? ` Di questi, ${brief.conto.resolvable} hanno già in memoria la fattura che corrisponde.`
              : ''}
          </p>
          <span className="brain-meta">calcolato senza modello, dalla scheda Conto</span>
        </div>
      ) : null}

      {oggi.length ? (
        <div className="brain-section">
          <h2>Oggi e domani</h2>
          <div className="brain-answer" style={{ marginTop: 0 }}>
            {oggi.map((c, i) => (
              <ClaimCard key={i} claim={c} />
            ))}
          </div>
        </div>
      ) : null}

      {novita.length ? (
        <div className="brain-section">
          <h2>Cosa è arrivato</h2>
          <div className="brain-answer" style={{ marginTop: 0 }}>
            {novita.map((c, i) => (
              <ClaimCard key={i} claim={c} />
            ))}
          </div>
        </div>
      ) : null}

      {brief && !oggi.length && !novita.length ? (
        <p className="brain-empty">
          Niente in agenda e niente di nuovo che richieda qualcosa da te. Un brief corto e vero batte
          un brief lungo e gonfiato.
        </p>
      ) : null}

      <div className="brain-section">
        <h2>
          Punti aperti {points.length ? <span className="brain-tag">{points.length}</span> : null}
        </h2>
        <p className="brain-note" style={{ marginBottom: '0.75rem' }}>
          Si chiudono <b>solo a mano</b>. Nessuno li toglie perché non se ne parla più: è il motivo
          per cui questa lista si può guardare con fiducia.
        </p>

        <div className="brain-list">
          {points.map((p) => (
            <div key={p.id} className="brain-row">
              <span className="brain-dot" data-state={p.age === 'fermo' ? 'off' : p.age === 'in attesa' ? 'configured' : 'connected'} />
              <div className="brain-row-main">
                <div className="brain-row-title">{p.text}</div>
                <div className="brain-meta" style={{ marginTop: '0.25rem' }}>
                  aperto da {daysSince(p.openedAt)} giorn{daysSince(p.openedAt) === 1 ? 'o' : 'i'}
                  {p.citations.length ? ` · ${p.citations[0].title || CHANNEL_LABEL[p.citations[0].source]}` : ''}
                </div>
              </div>
              <span className="brain-tag" data-age={p.age}>
                {AGE_LABEL[p.age]}
              </span>
              <button type="button" className="brain-del" onClick={() => void act(p.id, 'close')} title="Chiudi">
                chiudi
              </button>
            </div>
          ))}
          {!points.length ? <p className="brain-empty">Nessun punto aperto.</p> : null}
        </div>
      </div>
    </section>
  )
}
