'use client'

import { useState } from 'react'
import type { PracticeReport } from '@/lib/brain/agents/practice'
import type { Matter } from '@/lib/brain/practice'
import { formatEuro } from '@/lib/brain/reconcile'

/**
 * La scheda Studio.
 *
 * Tre liste da lunedì mattina, poi tutte le pratiche. Le ore sono una
 * stima — un incontro vale la sua durata, una mail dieci minuti — e la
 * scheda lo dice: serve a vedere chi assorbe tempo senza una fattura
 * dietro, non a sostituire il timesheet.
 */

function itDay(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function n(v: number): string {
  return String(v).replace('.', ',')
}

function Row({ m, tone, hint }: { m: Matter; tone: 'off' | 'configured' | 'connected'; hint?: string }) {
  return (
    <div className="brain-row">
      <span className="brain-dot" data-state={tone} />
      <div className="brain-row-main">
        <div className="brain-row-title">
          {m.label}
          {m.isNew ? <span className="brain-tag" data-age="in attesa" style={{ marginLeft: '0.5rem' }}>nuovo</span> : null}
          {!m.engagement && !m.key.includes('@') && m.touches >= 3 ? <span className="brain-tag" data-age="fermo" style={{ marginLeft: '0.375rem' }}>senza incarico</span> : null}
        </div>
        <div className="brain-row-hint">
          {hint ?? `${n(m.hours)} h stimate · ${m.touches} contatti · ultimo ${itDay(m.lastTouchAt)}`}
          {m.lastInvoiceAt ? ` · ultima fattura ${itDay(m.lastInvoiceAt)} (€ ${formatEuro(m.lastInvoiceCents ?? 0)})` : ' · nessuna fattura in memoria'}
          {m.engagement ? ` · incarico: ${m.engagement.title}` : ''}
        </div>
      </div>
    </div>
  )
}

export default function PracticePanel() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<PracticeReport | null>(null)

  async function run() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/brain/practice')
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Non sono riuscito a leggere le pratiche.')
      else setReport(data as PracticeReport)
    } catch {
      setError('Connessione interrotta.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="brain-actions" style={{ marginBottom: '1rem' }}>
        <button type="button" className="brain-btn brain-btn-primary" onClick={() => void run()} disabled={busy}>
          {busy ? 'Conto le ore…' : 'Lo studio, oggi'}
        </button>
      </div>

      <details className="brain-how">
        <summary>Come funziona</summary>
        <p className="brain-note">
          Le ore sono una <b>stima</b>: un incontro vale la sua durata, una mail scritta dieci minuti,
          una ricevuta cinque. Non è il timesheet: serve a vedere <b>chi assorbe tempo senza una
          fattura dietro</b>, chi lavora con te senza una lettera di incarico in memoria, e chi è un
          nome nuovo — il momento del controllo dei conflitti. Senza modello.
        </p>
      </details>

      {error ? <p className="brain-error" style={{ marginTop: '1rem' }}>{error}</p> : null}

      {report ? (
        <div className="brain-answer">
          <div className="brain-verdict" data-tone={report.unbilled.length || report.withoutEngagement.length ? 'warn' : 'ok'}>
            <span className="brain-verdict-label">
              {report.matters.length} pratiche attive
            </span>
            <p>
              {report.unbilled.length} con ore non fatturate · {report.withoutEngagement.length} senza incarico · {report.newContacts.length} nomi nuovi questa settimana. Su {report.examined} documenti in memoria.
            </p>
          </div>

          {report.unbilled.length ? (
            <div className="brain-section">
              <h2>Ore senza fattura dietro</h2>
              <div className="brain-list">
                {report.unbilled.map((m) => (
                  <Row key={m.key} m={m} tone="off" hint={`${n(m.unbilledHours)} h stimate dall'ultima fattura · ${m.touches} contatti`} />
                ))}
              </div>
            </div>
          ) : null}

          {report.withoutEngagement.length ? (
            <div className="brain-section">
              <h2>Senza lettera di incarico in memoria</h2>
              <div className="brain-list">
                {report.withoutEngagement.map((m) => <Row key={m.key} m={m} tone="configured" />)}
              </div>
            </div>
          ) : null}

          {report.newContacts.length ? (
            <div className="brain-section">
              <h2>Nomi nuovi: controllo dei conflitti</h2>
              <div className="brain-list">
                {report.newContacts.map((m) => <Row key={m.key} m={m} tone="configured" />)}
              </div>
            </div>
          ) : null}

          <div className="brain-section">
            <h2>Tutte le pratiche</h2>
            <div className="brain-list">
              {report.matters.map((m) => <Row key={m.key} m={m} tone="connected" />)}
              {!report.matters.length ? <p className="brain-empty">Nessuna pratica: la memoria non ha ancora mail né incontri con qualcuno.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
