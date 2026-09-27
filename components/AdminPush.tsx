'use client'

import { useEffect, useState } from 'react'
import { Schedina } from '@/lib/types'
import { nomeBreve } from '@/lib/teams'

interface StatoPush { configurato: boolean; migrazione: boolean; dispositivi: number; giocatori: number; soloMiei: number }

export async function inviaPush(body: Record<string, unknown>): Promise<string> {
  try {
    const res = await fetch('/api/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await res.json()
    if (!res.ok) return `⚠️ ${j.error ?? 'Invio non riuscito'}`
    return `📣 ${j.inviate} inviate${j.rimosse ? ` · ${j.rimosse} dispositivi rimossi` : ''}${j.errori ? ` · ${j.errori} errori` : ''}`
  } catch {
    return '⚠️ Invio non riuscito'
  }
}

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Chiavi VAPID generate nel browser di chi amministra: non passano da nessun server.
async function generaChiavi(): Promise<{ pub: string; priv: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const pub = await crypto.subtle.exportKey('raw', kp.publicKey)
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  return { pub: b64url(pub), priv: jwk.d ?? '' }
}

export default function AdminPush({ schedine }: { schedine: Schedina[] }) {
  const [stato, setStato] = useState<StatoPush | null>(null)
  const [esito, setEsito] = useState('')
  const [busy, setBusy] = useState(false)
  const [titolo, setTitolo] = useState('')
  const [testo, setTesto] = useState('')
  const [chiavi, setChiavi] = useState<{ pub: string; priv: string } | null>(null)

  useEffect(() => {
    fetch('/api/push/send').then(r => r.json()).then(setStato).catch(() => setStato(null))
  }, [])

  const aperte = schedine
    .filter(s => s.attiva !== false && new Date(s.deadline) > new Date())
    .sort((a, b) => a.deadline.localeCompare(b.deadline))

  async function invia(body: Record<string, unknown>, conferma?: string): Promise<boolean> {
    if (conferma && !window.confirm(conferma)) return false
    setBusy(true)
    const e = await inviaPush(body)
    setEsito(e)
    setBusy(false)
    return e.startsWith('📣')
  }

  return (
    <div className="space-y-5">
      {stato && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
            <div className="font-display font-extrabold text-2xl">{stato.giocatori}</div>
            <div className="text-[11px] text-[var(--muted)]">giocatori iscritti</div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
            <div className="font-display font-extrabold text-2xl">{stato.dispositivi}</div>
            <div className="text-[11px] text-[var(--muted)]">dispositivi</div>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-center">
            <div className="font-display font-extrabold text-2xl">{stato.soloMiei}</div>
            <div className="text-[11px] text-[var(--muted)]">solo i loro minuti</div>
          </div>
        </div>
      )}

      {stato && !stato.migrazione && (
        <p className="text-sm text-[var(--gold)]">⚠️ Manca la tabella delle iscrizioni: eseguire <code>supabase/migration_push.sql</code>.</p>
      )}

      {stato && !stato.configurato && (
        <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-4 text-sm space-y-3">
          <p>
            <strong>Notifiche non ancora attive.</strong> Servono due chiavi su Vercel (Settings → Environment Variables,
            Production e Preview), poi un nuovo deploy.
          </p>
          {!chiavi ? (
            <button onClick={async () => setChiavi(await generaChiavi())} className="btn-ghost px-4 py-2 text-sm">Genera le chiavi</button>
          ) : (
            <>
              <pre className="text-[11px] bg-black/40 rounded-lg p-3 overflow-x-auto select-all whitespace-pre-wrap break-all">{`VAPID_PUBLIC_KEY=${chiavi.pub}
VAPID_PRIVATE_KEY=${chiavi.priv}
VAPID_SUBJECT=mailto:tua@email.it`}</pre>
              <p className="text-xs text-[var(--muted)]">
                Generate in questo browser, non salvate da nessuna parte: copiale ora. La privata va solo su Vercel.
                Se la perdi, generane un&apos;altra coppia: i giocatori dovranno riattivare le notifiche.
              </p>
            </>
          )}
        </div>
      )}

      {stato?.configurato && (
        <>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => invia({ tipo: 'prova' })} disabled={busy} className="btn-ghost px-4 py-2 text-sm">🔔 Prova sul mio telefono</button>
            {aperte.map(s => (
              <button key={s.id} disabled={busy} className="btn-ghost px-4 py-2 text-sm"
                onClick={() => invia({ tipo: 'promemoria', schedina_id: s.id }, `Mandare il promemoria per "${nomeBreve(s.nome)}" a chi non ha ancora giocato?`)}>
                ⏳ Promemoria · {nomeBreve(s.nome)}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)]">
            La prova arriva solo sui tuoi dispositivi (attiva prima le notifiche dal tuo Profilo).
            Il promemoria va solo a chi non ha ancora inviato il pronostico.
          </p>

          <div className="rounded-xl border border-white/10 p-4 space-y-2">
            <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Messaggio a tutti gli iscritti</p>
            <input value={titolo} onChange={e => setTitolo(e.target.value)} maxLength={80} placeholder="Titolo" className="input-field w-full px-3 py-2 text-sm" />
            <textarea value={testo} onChange={e => setTesto(e.target.value)} maxLength={200} rows={2} placeholder="Testo (max 200 caratteri)" className="input-field w-full px-3 py-2 text-sm resize-none" />
            <button disabled={busy || !titolo.trim() || !testo.trim()} className="btn-primary px-5 py-2 text-sm"
              onClick={() => invia({ tipo: 'messaggio', titolo, testo }, `Inviare a tutti i ${stato.giocatori} giocatori iscritti?`).then(ok => { if (ok) { setTitolo(''); setTesto('') } })}>
              Invia a tutti
            </button>
          </div>
        </>
      )}

      {esito && <p className="text-sm">{esito}</p>}
    </div>
  )
}
