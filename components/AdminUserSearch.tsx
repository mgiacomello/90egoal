'use client'

import { useState, useEffect } from 'react'
import { Schedina, Pronostico, Profile, ClassificaRow } from '@/lib/types'
import Flag from '@/components/Flag'

interface Props {
  schedine: Schedina[]
  profiles: Profile[]
  pronostici: Pronostico[]
  classifica: ClassificaRow[]
}

export default function AdminUserSearch({ schedine, profiles, pronostici, classifica }: Props) {
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [sample, setSample] = useState<string[]>([])

  const giocatori = profiles.filter(p => !p.is_admin)

  // 5 nomi casuali di default (scelti al mount, lato client → niente mismatch SSR)
  useEffect(() => {
    const ids = giocatori.map(p => p.id)
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]] }
    setSample(ids.slice(0, 5))
  }, [giocatori.length])

  const pronById = new Map<string, Pronostico[]>()
  pronostici.forEach(p => { const a = pronById.get(p.user_id) ?? []; a.push(p); pronById.set(p.user_id, a) })
  const classByKey = new Map<string, ClassificaRow>()
  classifica.forEach(c => classByKey.set(`${c.schedina_id}:${c.user_id}`, c))
  const totByUser = new Map<string, number>()
  classifica.forEach(c => totByUser.set(c.user_id, (totByUser.get(c.user_id) ?? 0) + c.totale))
  const schedinaNome = (id: number) => schedine.find(s => s.id === id)?.nome.replace(' — Mondiali FIFA 2026', '') ?? `Schedina ${id}`

  const ql = q.trim().toLowerCase()
  const mapped = giocatori.map(p => ({ p, tot: totByUser.get(p.id) ?? 0, n: (pronById.get(p.id) ?? []).length }))

  const list = ql
    ? mapped.filter(x => x.p.username.toLowerCase().includes(ql) || (x.p.full_name || '').toLowerCase().includes(ql) || (x.p.email || '').toLowerCase().includes(ql))
            .sort((a, b) => b.tot - a.tot || a.p.username.localeCompare(b.p.username))
    : mapped.filter(x => sample.includes(x.p.id))

  // quando la ricerca dà un solo risultato, apri direttamente quell'utente
  const autoOpen = ql && list.length === 1 ? list[0].p.id : null

  return (
    <div>
      <div className="mb-4">
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Giocate</span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mt-1">🔎 Cerca un giocatore</h2>
        <p className="text-[var(--muted)] text-sm mt-1">Cerca per nome, nickname o email e apri la sua scheda con tutte le scommesse.</p>
      </div>

      <div className="relative mb-3">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">🔍</span>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Cerca giocatore… (nome, nickname o email)"
          className="input-field w-full pl-11 pr-10 py-3 text-sm"
        />
        {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white text-sm">✕</button>}
      </div>

      <p className="text-xs text-[var(--muted)] mb-3">
        {ql ? `${list.length} risultati per "${q}"` : `Anteprima di 5 giocatori a caso (di ${giocatori.length}) — cerca per trovarne uno`}
      </p>

      <div className="space-y-2">
        {list.length === 0 && (
          <div className="glass rounded-xl p-6 text-center text-[var(--muted)] text-sm">Nessun giocatore trovato.</div>
        )}
        {list.map(({ p, tot, n }) => {
          const isOpen = openId === p.id || autoOpen === p.id
          const prons = (pronById.get(p.id) ?? []).sort((a, b) => a.schedina_id - b.schedina_id)
          return (
            <div key={p.id} className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : p.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-[var(--muted)] text-xs w-4 shrink-0">{isOpen ? '▾' : '▸'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.username}{p.full_name ? <span className="text-[var(--muted)] font-normal text-sm ml-2">{p.full_name}</span> : null}</div>
                  {p.email && <div className="text-xs text-[var(--muted)] truncate">{p.email}</div>}
                </div>
                <span className="text-xs text-[var(--muted)] shrink-0">{n} sched.</span>
                <span className="font-display font-extrabold text-[var(--accent-soft)] tabular-nums shrink-0 w-14 text-right">{tot} <span className="text-[10px] text-[var(--muted)] font-normal">pt</span></span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-white/8 space-y-3">
                  {prons.length === 0 && <p className="text-sm text-[var(--muted)] pt-2">Nessuna scommessa inviata.</p>}
                  {prons.map(g => {
                    const c = classByKey.get(`${g.schedina_id}:${g.user_id}`)
                    const azz = new Set(c?.minuti_azzeccati ?? [])
                    return (
                      <div key={g.id} className="bg-white/[0.03] border border-white/8 rounded-lg p-3">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                          <span className="font-semibold text-sm">{schedinaNome(g.schedina_id)}</span>
                          {c ? (
                            <span className="font-display font-bold text-[var(--accent-soft)] text-sm tabular-nums">
                              {c.totale} pt <span className="text-[var(--muted)] text-xs font-normal">({c.punti_minuti}m · {c.punti_recupero}r · {c.punti_bonus}b)</span>
                            </span>
                          ) : <span className="text-xs text-[var(--muted)]">in attesa risultati</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {g.minuti.map(m => (
                            <span key={m} className={`tag-static ${c && !azz.has(m) ? 'is-miss' : (c ? '' : 'is-miss')} px-1.5 py-0.5 text-[11px]`}>{m}&apos;</span>
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
                          {g.recupero && <span>➕ {g.recupero === 'primo' ? 'Rec. 1°T' : 'Rec. 2°T'}</span>}
                          {g.first_goal && <span className="flex items-center gap-1">🥇 <Flag team={g.first_goal} w={40} className="w-4 h-3" /><span className="text-white/80">{g.first_goal}</span></span>}
                          {g.last_goal && <span className="flex items-center gap-1">🏁 <Flag team={g.last_goal} w={40} className="w-4 h-3" /><span className="text-white/80">{g.last_goal}</span></span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
