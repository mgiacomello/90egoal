'use client'

import { useState } from 'react'
import { Profile, Pronostico, ActivitySummary, Schedina } from '@/lib/types'

interface Props {
  profiles: Profile[]
  pronostici: Pronostico[]
  activity: ActivitySummary[]
  schedine: Schedina[]
}

function fmtDurata(min: number): string {
  if (!min) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h === 0 ? `${m} min` : `${h}h ${m}m`
}
function fmtData(s?: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Europe/Rome' })
}
function fmtDataOra(s?: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
}

export default function AdminUsers({ profiles, pronostici, activity }: Props) {
  const [q, setQ] = useState('')

  const giocatori = profiles.filter(p => !p.is_admin)
  const actByUser = new Map(activity.map(a => [a.user_id, a]))
  const pronByUser = new Map<string, Pronostico[]>()
  pronostici.forEach(p => {
    const arr = pronByUser.get(p.user_id) ?? []
    arr.push(p)
    pronByUser.set(p.user_id, arr)
  })

  // aggregati (solo giocatori)
  const ids = new Set(giocatori.map(g => g.id))
  const attG = activity.filter(a => ids.has(a.user_id))
  const tempoTotale = attG.reduce((acc, a) => acc + (a.minuti_attivi || 0), 0)
  const utentiAttivi = attG.length

  const ql = q.trim().toLowerCase()
  const tutti = [...giocatori].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  const filtered = ql
    ? tutti.filter(p => p.username.toLowerCase().includes(ql) || (p.full_name || '').toLowerCase().includes(ql) || (p.email || '').toLowerCase().includes(ql))
    : tutti.slice(0, 5)

  const righe = filtered.map(g => ({ g, act: actByUser.get(g.id), n: (pronByUser.get(g.id) ?? []).length }))

  return (
    <div>
      <div className="mb-6">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#a78bfa' }}>Utenti</span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mt-1">👥 Chi si è registrato</h2>
        <p className="text-[var(--muted)] text-sm mt-1">Ultimi iscritti in evidenza; cerca per vedere chiunque (anagrafica, permanenza, attività).</p>
      </div>

      {/* Aggregati */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Card n={giocatori.length} l="Giocatori registrati" />
        <Card n={utentiAttivi} l="Utenti con attività" />
        <Card n={fmtDurata(tempoTotale)} l="Tempo totale in piattaforma" />
        <Card n={pronostici.length} l="Pronostici inviati" />
      </div>

      {/* Ricerca */}
      <div className="relative mb-3">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">🔍</span>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Cerca utente… (nome, nickname o email)"
          className="input-field w-full pl-11 pr-10 py-3 text-sm"
        />
        {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white text-sm">✕</button>}
      </div>

      <p className="text-xs text-[var(--muted)] mb-3">
        {ql ? `${filtered.length} risultati per "${q}"` : `Ultimi 5 registrati (di ${giocatori.length} totali) — cerca per vederli tutti`}
      </p>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-[var(--muted)] text-xs uppercase tracking-wider border-b border-white/8">
              <th className="text-left px-4 py-3">Utente</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-3 py-3">Registrato</th>
              <th className="text-center px-3 py-3">Permanenza</th>
              <th className="text-center px-3 py-3">Giorni</th>
              <th className="text-left px-3 py-3">Ultimo accesso</th>
              <th className="text-center px-3 py-3">Giocate</th>
            </tr>
          </thead>
          <tbody>
            {righe.map(({ g, act, n }) => (
              <tr key={g.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">{g.username}</div>
                  {g.full_name && <div className="text-xs text-[var(--muted)]">{g.full_name}</div>}
                </td>
                <td className="px-4 py-3 text-[var(--muted)] text-xs">{g.email ?? '—'}</td>
                <td className="px-3 py-3 text-[var(--muted)] whitespace-nowrap">{fmtData(g.created_at)}</td>
                <td className="px-3 py-3 text-center whitespace-nowrap">
                  <span className={act?.minuti_attivi ? 'text-[var(--accent-soft)] font-semibold' : 'text-[var(--muted)]'}>{fmtDurata(act?.minuti_attivi ?? 0)}</span>
                </td>
                <td className="px-3 py-3 text-center text-white/70 tabular-nums">{act?.giorni_attivi ?? 0}</td>
                <td className="px-3 py-3 text-[var(--muted)] text-xs whitespace-nowrap">{fmtDataOra(act?.ultimo_accesso)}</td>
                <td className="px-3 py-3 text-center tabular-nums">{n}</td>
              </tr>
            ))}
            {righe.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">Nessun utente trovato.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--muted)] mt-2">La permanenza è stimata in base all&apos;attività (≈ 1 minuto per battito mentre la scheda è aperta).</p>
    </div>
  )
}

function Card({ n, l }: { n: number | string; l: string }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <div className="font-display font-extrabold text-2xl text-gradient tabular-nums">{n}</div>
      <div className="text-[11px] text-[var(--muted)] mt-1 leading-tight">{l}</div>
    </div>
  )
}
