'use client'

import { useEffect, useState } from 'react'
import MandatesPanel from '@/components/brain/MandatesPanel'
import type { BriefOpenPoint } from '@/lib/brain/agents/brief'
import type { ConnectorStatus } from '@/lib/brain/connectors/types'
import { EXECUTIVES, type ExecutiveKey } from '@/lib/brain/executives'

/**
 * Oggi: la prima pagina.
 *
 * Chi apre la console deve capire in dieci secondi tre cose: se BRAIN
 * vede qualcosa (le fonti), cosa c'è da fare adesso (mandati, punti
 * aperti, chi si è fatto vivo), e dove andare per il resto. Finché
 * non c'è nessuna fonte collegata, la pagina è una lista di passi e
 * basta: una console vuota che spiega sé stessa è peggio di una che
 * dice cosa manca.
 */

type StoredClaim = { text: string }
type StoredBrief = { at?: string; generatedAt?: string; oggi?: StoredClaim[]; novita?: StoredClaim[]; scadenze?: { date: string; label: string; title: string; overdue: boolean }[] }
type SentInitiative = { key: string; executive: string; kind: string; text: string; at: string }

type Props = {
  ownerEmail: string
  connectors: ConnectorStatus[]
  brief: StoredBrief | null
  points: BriefOpenPoint[]
  total: number
  autoSync: { at: string; stored: number; detail: string } | null
  go: (tab: 'brief' | 'board' | 'sources' | 'memory' | 'ask' | 'inbox' | 'deadlines') => void
}

function greeting(d: Date): string {
  const h = Number(d.toLocaleString('it-IT', { hour: '2-digit', hour12: false, timeZone: 'Europe/Rome' }))
  return h < 6 ? 'Notte fonda' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'
}

function longDate(d: Date): string {
  const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function when(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function itDay(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}` : iso
}

export default function TodayPanel({ ownerEmail, connectors, brief, points, total, autoSync, go }: Props) {
  const [now, setNow] = useState<Date | null>(null)
  const [initiatives, setInitiatives] = useState<SentInitiative[] | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/brain/initiatives')
      .then((res) => (res.ok ? res.json() : { initiatives: [] }))
      .then((data) => {
        if (alive) {
          setInitiatives((data.initiatives ?? []).slice(0, 5))
          setNow(new Date())
        }
      })
      .catch(() => {
        if (alive) {
          setInitiatives([])
          setNow(new Date())
        }
      })
    return () => {
      alive = false
    }
  }, [])

  const connected = connectors.filter((c) => c.connected)
  const google = connectors.find((c) => c.key === 'gmail')
  const nothing = connected.length === 0
  const name = ownerEmail.split('@')[0].split(/[._-]/)[0]
  const firstName = name.charAt(0).toUpperCase() + name.slice(1)
  const stuck = points.filter((p) => p.age === 'fermo').length

  return (
    <section>
      <div className="brain-hero">
        <div>
          <p className="brain-kicker">{now ? longDate(now) : ' '}</p>
          <h1 className="brain-h1">{now ? greeting(now) : 'Ciao'}, {firstName}.</h1>
        </div>
        <div className="brain-hero-side">
          <span className="brain-stat"><b>{total.toLocaleString('it-IT')}</b> in memoria</span>
          <span className="brain-stat"><b>{connected.length}</b>/{connectors.length} fonti</span>
          <span className="brain-stat"><b>{points.length}</b> punti aperti{stuck ? ` · ${stuck} fermi` : ''}</span>
        </div>
      </div>

      {nothing ? (
        <div className="brain-setup">
          <h2>BRAIN non vede ancora niente</h2>
          <p>
            Nessuna fonte è collegata, quindi memoria, brief, board e mandati sono vuoti: non è rotto, è spento.
            Tre passi, nell&rsquo;ordine che conta.
          </p>
          <ol className="brain-steps">
            <li data-done={google?.connected ? 'yes' : 'no'}>
              <b>Collega Google</b> — email, agenda e Drive. È la fonte da cui nasce quasi tutto.
              {google?.configured ? (
                <a className="brain-btn brain-btn-primary" href="/api/brain/connect/google">Collega Google</a>
              ) : (
                <span className="brain-step-hint">Mancano <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> su Vercel: il pulsante compare appena ci sono.</span>
              )}
            </li>
            <li>
              <b>Dì chi sei</b> — tre righe di profilo che ogni dirigente legge prima di scrivere.
              <button type="button" className="brain-btn" onClick={() => go('memory')}>Scrivi il profilo</button>
            </li>
            <li>
              <b>Prova subito</b> — incolla una nota in memoria e fai una domanda: vedi la fonte sotto la frase.
              <button type="button" className="brain-btn" onClick={() => go('ask')}>Chiedi qualcosa</button>
            </li>
          </ol>
          <p className="brain-meta">Qonto, Oura, WhatsApp e il brief via mail si aggiungono dopo, una chiave alla volta, dalla scheda <button type="button" className="brain-link" onClick={() => go('sources')}>Fonti</button>.</p>
        </div>
      ) : null}

      <div className="brain-grid">
        <div className="brain-card">
          <div className="brain-card-head">
            <h2>Il brief</h2>
            <button type="button" className="brain-link" onClick={() => go('brief')}>apri</button>
          </div>
          {brief && (brief.oggi?.length || brief.novita?.length || brief.scadenze?.length) ? (
            <>
              <ul className="brain-plain">
                {(brief.oggi ?? []).slice(0, 3).map((c, i) => <li key={`o${i}`}>{c.text}</li>)}
                {(brief.novita ?? []).slice(0, 2).map((c, i) => <li key={`n${i}`}>{c.text}</li>)}
              </ul>
              {brief.scadenze?.length ? (
                <p className="brain-meta">Scadenze: {brief.scadenze.slice(0, 3).map((s) => `${itDay(s.date)} ${s.label}`).join(' · ')}</p>
              ) : null}
              <p className="brain-meta">scritto {when(brief.at ?? brief.generatedAt)}</p>
            </>
          ) : (
            <p className="brain-empty-left">{nothing ? 'Arriva ogni mattina, appena c\'è una fonte.' : 'Non ancora scritto: arriva ogni mattina dopo la sincronizzazione, o aprilo e chiedilo adesso.'}</p>
          )}
        </div>

        <div className="brain-card">
          <div className="brain-card-head">
            <h2>Punti aperti</h2>
            <button type="button" className="brain-link" onClick={() => go('brief')}>tutti</button>
          </div>
          {points.length ? (
            <ul className="brain-plain">
              {points.slice(0, 5).map((p, i) => (
                <li key={i}>
                  {p.text} <span className="brain-tag" data-age={p.age}>{p.age}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="brain-empty-left">Niente in sospeso. Un impegno preso in una call o una domanda ricevuta compaiono qui, e si chiudono solo a mano.</p>
          )}
        </div>

        <div className="brain-card">
          <div className="brain-card-head">
            <h2>Si sono fatti vivi</h2>
            <button type="button" className="brain-link" onClick={() => go('board')}>il tavolo</button>
          </div>
          {initiatives === null ? null : initiatives.length ? (
            <ul className="brain-plain">
              {initiatives.map((i) => (
                <li key={`${i.key}-${i.at}`}>
                  <span className="brain-who">{EXECUTIVES[i.executive as ExecutiveKey]?.name ?? i.executive}</span>{' '}
                  {i.text.replace(/^\*[^*]+\*\s*·\s*/, '').replace(/\*/g, '').replace(/_/g, '').slice(0, 160)}
                  <span className="brain-meta"> · {when(i.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="brain-empty-left">Ogni mezz&rsquo;ora i dirigenti controllano se c&rsquo;è qualcosa da dirti. Quando succede, lo leggi qui e sul telefono.</p>
          )}
        </div>

        <div className="brain-card">
          <div className="brain-card-head">
            <h2>Le fonti</h2>
            <button type="button" className="brain-link" onClick={() => go('sources')}>gestisci</button>
          </div>
          <div className="brain-chips">
            {connectors.map((c) => (
              <span key={c.key} className="brain-chip-static" data-state={c.connected ? 'connected' : c.configured ? 'configured' : 'off'}>
                <span className="brain-dot" data-state={c.connected ? 'connected' : c.configured ? 'configured' : 'off'} />
                {c.label}
              </span>
            ))}
          </div>
          <p className="brain-meta">
            {autoSync
              ? `Ultima sincronizzazione automatica ${when(autoSync.at)} — ${autoSync.detail}.`
              : 'La sincronizzazione automatica non è ancora mai girata.'}
          </p>
        </div>
      </div>

      <MandatesPanel />
    </section>
  )
}
