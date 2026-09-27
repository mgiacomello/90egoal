'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Fase, Partita, Schedina } from '@/lib/types'
import { firstKickoffIso, romeToUtcIso, utcToRome } from '@/lib/time'
import { nomeBreve, parseElencoPartite } from '@/lib/teams'

interface Props {
  schedine: Schedina[]
  pronosticiBySched: Record<number, number>
}

const COMPETIZIONI = ['Serie A', 'Serie B', 'Serie C', 'Altro']
const FASI: { v: Fase; l: string }[] = [
  { v: 'campionato', l: 'Campionato (niente supplementari)' },
  { v: 'eliminazione', l: 'Eliminazione diretta (+5 supplementari)' },
  { v: 'gironi', l: 'Gironi' },
]

interface Bozza {
  id: number | null
  nome: string
  torneo: string
  fase: Fase
  attiva: boolean
  deadlineDate: string
  deadlineTime: string
  partite: Partita[]
}

function vuota(torneo: string): Bozza {
  return { id: null, nome: '', torneo, fase: 'campionato', attiva: true, deadlineDate: '', deadlineTime: '', partite: [] }
}

function daSchedina(s: Schedina): Bozza {
  const { date, time } = utcToRome(s.deadline)
  return {
    id: s.id,
    nome: s.nome,
    torneo: s.torneo ?? '',
    fase: s.fase ?? 'eliminazione',
    attiva: s.attiva !== false,
    deadlineDate: date,
    deadlineTime: time,
    partite: s.partite.map(p => ({ ...p })),
  }
}

export default function AdminSchedine({ schedine, pronosticiBySched }: Props) {
  const router = useRouter()
  const tornei = useMemo(() => [...new Set(schedine.map(s => s.torneo).filter(Boolean) as string[])], [schedine])
  const torneoCorrente = [...schedine].reverse().find(s => s.attiva !== false)?.torneo ?? tornei[tornei.length - 1] ?? ''

  const [bozza, setBozza] = useState<Bozza | null>(null)
  const [incolla, setIncolla] = useState('')
  const [scartate, setScartate] = useState<string[]>([])
  const [dataIncolla, setDataIncolla] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)

  const nPron = bozza?.id ? pronosticiBySched[bozza.id] ?? 0 : 0

  function set<K extends keyof Bozza>(k: K, v: Bozza[K]) {
    setBozza(b => (b ? { ...b, [k]: v } : b))
    setMsg(null)
  }
  function setPartita(i: number, patch: Partial<Partita>) {
    setBozza(b => (b ? { ...b, partite: b.partite.map((p, j) => (j === i ? { ...p, ...patch } : p)) } : b))
    setMsg(null)
  }
  function aggiungiRiga() {
    setBozza(b => {
      if (!b) return b
      const last = b.partite[b.partite.length - 1]
      const nuova: Partita = { home: '', away: '', date: last?.date ?? b.deadlineDate, ora: last?.ora ?? null, competizione: last?.competizione ?? 'Serie A' }
      return { ...b, partite: [...b.partite, nuova] }
    })
  }
  function importa() {
    const { partite, scartate } = parseElencoPartite(incolla)
    const data = dataIncolla || bozza?.deadlineDate || ''
    setBozza(b => (b ? {
      ...b,
      partite: [...b.partite, ...partite.map(p => ({ home: p.home, away: p.away, date: data, ora: p.ora, competizione: p.competizione }))],
    } : b))
    setScartate(scartate)
    setIncolla('')
  }
  function usaPrimoCalcio() {
    if (!bozza) return
    const iso = firstKickoffIso(bozza.partite)
    if (!iso) { setMsg({ ok: false, t: 'Nessuna partita ha data e ora: inserisci la scadenza a mano.' }); return }
    const { date, time } = utcToRome(iso)
    setBozza({ ...bozza, deadlineDate: date, deadlineTime: time })
  }

  async function salva() {
    if (!bozza) return
    const partite = bozza.partite
      .map(p => ({ ...p, home: p.home.trim(), away: p.away.trim(), ora: p.ora?.trim() || null, competizione: p.competizione || null }))
      .filter(p => p.home || p.away)
    const errori: string[] = []
    if (!bozza.nome.trim()) errori.push('manca il nome')
    if (!bozza.torneo.trim()) errori.push('manca il torneo')
    if (!bozza.deadlineDate || !bozza.deadlineTime) errori.push('manca la scadenza')
    if (partite.length === 0) errori.push('nessuna partita')
    partite.forEach((p, i) => {
      if (!p.home || !p.away) errori.push(`partita ${i + 1}: squadre incomplete`)
      if (!p.date) errori.push(`partita ${i + 1}: manca la data`)
      if (p.ora && !/^\d{1,2}:\d{2}$/.test(p.ora)) errori.push(`partita ${i + 1}: ora non valida (usa 14:30)`)
    })
    if (errori.length) { setMsg({ ok: false, t: 'Da sistemare: ' + errori.join(' · ') }); return }

    const deadline = romeToUtcIso(bozza.deadlineDate, bozza.deadlineTime)
    const primo = firstKickoffIso(partite)
    if (primo && deadline > primo && !window.confirm('La scadenza è DOPO il primo calcio d\'inizio: chi gioca potrebbe compilare a partita iniziata. Salvare lo stesso?')) return
    if (nPron > 0 && !window.confirm(`${nPron} giocatori hanno già inviato il pronostico. Se cambi squadre, i loro bonus prima/ultima rete potrebbero non valere più. Salvare?`)) return

    setSaving(true)
    const supabase = createClient()
    const row = { nome: bozza.nome.trim(), torneo: bozza.torneo.trim(), fase: bozza.fase, attiva: bozza.attiva, deadline, partite }
    const { error } = bozza.id
      ? await supabase.from('schedine').update(row).eq('id', bozza.id)
      : await supabase.from('schedine').insert(row)
    setSaving(false)
    if (error) { setMsg({ ok: false, t: error.message }); return }
    setMsg({ ok: true, t: 'Schedina salvata.' })
    setBozza(null)
    router.refresh()
  }

  const perTorneo = tornei.length ? tornei : ['']
  return (
    <div>
      <p className="text-[var(--muted)] text-sm mb-4">
        Crea e modifica le schedine. Orari sempre in <strong className="text-white">ora italiana</strong>. La scadenza di solito è il primo calcio d&apos;inizio.
      </p>

      {!bozza && (
        <>
          <button onClick={() => { setBozza(vuota(torneoCorrente)); setScartate([]) }} className="btn-primary px-5 py-2.5 text-sm mb-5">+ Nuova schedina</button>
          {msg && <p className={`text-sm mb-4 ${msg.ok ? 'text-[var(--accent-soft)]' : 'text-red-300'}`}>{msg.t}</p>}
          <div className="space-y-5">
            {perTorneo.map(t => (
              <div key={t || 'nessuno'}>
                <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">{t || 'Senza torneo'}</p>
                <div className="space-y-2">
                  {schedine.filter(s => (s.torneo ?? '') === t).map(s => {
                    const { date, time } = utcToRome(s.deadline)
                    const senzaOra = s.partite.some(p => !p.ora)
                    return (
                      <button key={s.id} onClick={() => { setBozza(daSchedina(s)); setScartate([]); setMsg(null) }}
                        className="w-full glass glass-hover rounded-xl px-4 py-3 text-left flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{nomeBreve(s.nome)}</div>
                          <div className="text-xs text-[var(--muted)]">
                            {s.partite.length} partite · scadenza {date.split('-').reverse().join('/')} {time}
                            {' · '}{pronosticiBySched[s.id] ?? 0} pronostici
                            {senzaOra && <span className="text-[var(--gold)]"> · orari da completare</span>}
                          </div>
                        </div>
                        <span className={`text-xs shrink-0 ${s.attiva !== false ? 'text-[var(--accent-soft)]' : 'text-[var(--muted)]'}`}>
                          {s.attiva !== false ? 'attiva' : 'archivio'} ✎
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {bozza && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Nome</span>
              <input value={bozza.nome} onChange={e => set('nome', e.target.value)} placeholder="Giornata del 17 ottobre" className="input-field w-full px-3 py-2 text-sm mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Torneo (la classifica generale somma solo questo)</span>
              <input value={bozza.torneo} onChange={e => set('torneo', e.target.value)} list="tornei" className="input-field w-full px-3 py-2 text-sm mt-1" />
              <datalist id="tornei">{tornei.map(t => <option key={t} value={t} />)}</datalist>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--muted)]">Fase</span>
              <select value={bozza.fase} onChange={e => set('fase', e.target.value as Fase)} className="input-field w-full px-3 py-2 text-sm mt-1">
                {FASI.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 mt-6 text-sm">
              <input type="checkbox" checked={bozza.attiva} onChange={e => set('attiva', e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
              Attiva (visibile e giocabile). Tolta la spunta va in archivio.
            </label>
          </div>

          {/* Partite */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Partite ({bozza.partite.length})</span>
              <button type="button" onClick={aggiungiRiga} className="text-sm text-[var(--accent-soft)]">+ Aggiungi riga</button>
            </div>
            <div className="space-y-2">
              {bozza.partite.map((p, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[7rem_8.5rem_5rem_1fr_1fr_auto] gap-1.5 items-center rounded-xl bg-white/[0.03] border border-white/8 p-2">
                  <select value={p.competizione ?? ''} onChange={e => setPartita(i, { competizione: e.target.value || null })} className="input-field px-2 py-1.5 text-xs">
                    <option value="">—</option>
                    {COMPETIZIONI.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="date" value={p.date} onChange={e => setPartita(i, { date: e.target.value })} className="input-field px-2 py-1.5 text-xs" />
                  <input value={p.ora ?? ''} onChange={e => setPartita(i, { ora: e.target.value })} placeholder="14:30" inputMode="numeric" className="input-field px-2 py-1.5 text-xs font-mono" />
                  <input value={p.home} onChange={e => setPartita(i, { home: e.target.value })} placeholder="Casa" className="input-field px-2 py-1.5 text-sm" />
                  <input value={p.away} onChange={e => setPartita(i, { away: e.target.value })} placeholder="Trasferta" className="input-field px-2 py-1.5 text-sm" />
                  <button type="button" onClick={() => set('partite', bozza.partite.filter((_, j) => j !== i))} className="text-[var(--muted)] hover:text-red-400 px-2" title="Rimuovi">✕</button>
                </div>
              ))}
            </div>

            <details className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2">
              <summary className="cursor-pointer text-sm text-[var(--muted)]">📋 Incolla un elenco (anche da Word)</summary>
              <p className="text-xs text-[var(--muted)] mt-2">Una partita per riga, &quot;Casa – Trasferta&quot;. Le righe &quot;Ore 14.30&quot; e i suffissi &quot;Serie C&quot; valgono per le righe che seguono.</p>
              <textarea value={incolla} onChange={e => setIncolla(e.target.value)} rows={6} className="input-field w-full px-3 py-2 text-sm mt-2 font-mono"
                placeholder={'Ore 14.30\nReggiana – Torres Serie C\nVado – Sanbenedettese\nOre 15.00\nAscoli – Empoli Serie B'} />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-xs text-[var(--muted)]">Data delle partite</span>
                <input type="date" value={dataIncolla} onChange={e => setDataIncolla(e.target.value)} className="input-field px-2 py-1.5 text-xs" />
                <button type="button" onClick={importa} disabled={!incolla.trim()} className="btn-ghost px-4 py-1.5 text-sm">Aggiungi all&apos;elenco</button>
              </div>
              {scartate.length > 0 && (
                <p className="text-xs text-[var(--gold)] mt-2">Righe non lette, da inserire a mano: {scartate.join(' · ')}</p>
              )}
            </details>
          </div>

          {/* Scadenza */}
          <div>
            <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Scadenza pronostici (ora italiana)</span>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input type="date" value={bozza.deadlineDate} onChange={e => set('deadlineDate', e.target.value)} className="input-field px-3 py-2 text-sm" />
              <input type="time" value={bozza.deadlineTime} onChange={e => set('deadlineTime', e.target.value)} className="input-field px-3 py-2 text-sm" />
              <button type="button" onClick={usaPrimoCalcio} className="btn-ghost px-4 py-2 text-sm">= primo calcio d&apos;inizio</button>
            </div>
          </div>

          {nPron > 0 && <p className="text-xs text-[var(--gold)]">⚠️ {nPron} pronostici già inviati su questa schedina: cambia le squadre solo se è indispensabile.</p>}
          {msg && <div className={`text-sm rounded-xl px-4 py-3 border ${msg.ok ? 'text-[var(--accent-soft)] border-[var(--accent)]/40 bg-[var(--accent)]/10' : 'text-red-300 border-red-500/40 bg-red-500/10'}`}>{msg.t}</div>}

          <div className="flex gap-2">
            <button onClick={salva} disabled={saving} className="btn-primary flex-1 py-3">{saving ? 'Salvataggio…' : bozza.id ? 'Salva modifiche' : 'Crea schedina'}</button>
            <button onClick={() => { setBozza(null); setMsg(null) }} className="btn-ghost px-5 py-3">Annulla</button>
          </div>
        </div>
      )}
    </div>
  )
}
