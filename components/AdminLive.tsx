'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Risultato, Schedina, MatchDetail } from '@/lib/types'
import { buildDettaglio, deriveRisultato, matchKey, parseMinute, formatMinute, type GolLive, type StatoPartita } from '@/lib/live'
import { nomeBreve } from '@/lib/teams'
import Flag from '@/components/Flag'
import { inviaPush } from '@/components/AdminPush'

interface Props {
  schedine: Schedina[]
  risultatiMap: Record<number, Risultato>
}

type Stato = Record<string, { gol: GolLive[]; stato: StatoPartita }>

function statoIniziale(s: Schedina, r?: Risultato): Stato {
  const out: Stato = {}
  const dett = (r?.dettagli as MatchDetail[] | undefined) ?? []
  const byKey = new Map(dett.map(d => [matchKey(d), d]))
  for (const p of s.partite) {
    const d = byKey.get(matchKey(p))
    out[matchKey(p)] = {
      gol: d?.gol ? d.gol.map(g => ({ min: g.min, team: g.team })) : [],
      // Dati vecchi senza stato: se c'è un dettaglio, la partita era finita.
      stato: d?.stato ?? (d ? 'finita' : 'da_giocare'),
    }
  }
  return out
}

const STATI: { v: StatoPartita; l: string }[] = [
  { v: 'da_giocare', l: 'Da giocare' },
  { v: 'in_corso', l: '● Live' },
  { v: 'finita', l: 'Finita' },
]

export default function AdminLive({ schedine, risultatiMap }: Props) {
  const router = useRouter()
  const attive = schedine.filter(s => s.attiva !== false)
  const [mostraArchivio, setMostraArchivio] = useState(false)
  const elenco = mostraArchivio ? schedine : attive

  const [selId, setSelId] = useState<number | null>(attive[0]?.id ?? null)
  const schedina = schedine.find(s => s.id === selId) ?? null
  const [stato, setStato] = useState<Stato>(() => (schedina ? statoIniziale(schedina, risultatiMap[schedina.id]) : {}))
  const [minuto, setMinuto] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notifiche, setNotifiche] = useState(true)
  const [esitoPush, setEsitoPush] = useState('')

  function scegli(id: number) {
    const s = schedine.find(x => x.id === id)
    if (!s) return
    setSelId(id)
    setStato(statoIniziale(s, risultatiMap[id]))
    setMinuto({})
    setSavedAt(null)
    setError('')
  }

  function derivato(st: Stato) {
    if (!schedina) return null
    const dettagli = schedina.partite
      .filter(p => st[matchKey(p)] && (st[matchKey(p)].stato !== 'da_giocare' || st[matchKey(p)].gol.length > 0))
      .map(p => buildDettaglio(p, st[matchKey(p)].gol, st[matchKey(p)].stato))
    return deriveRisultato(schedina.partite, dettagli)
  }

  async function salva(next: Stato): Promise<boolean> {
    if (!schedina) return false
    setStato(next)
    setSaving(true)
    setError('')
    const dettagli = schedina.partite
      .map(p => ({ p, st: next[matchKey(p)] }))
      .filter(({ st }) => st && (st.stato !== 'da_giocare' || st.gol.length > 0))
      .map(({ p, st }) => buildDettaglio(p, st.gol, st.stato))
    const d = deriveRisultato(schedina.partite, dettagli)
    const prec = risultatiMap[schedina.id]
    const payload = {
      schedina_id: schedina.id,
      dettagli,
      minuti_gol: d.minuti_gol,
      recupero: d.recupero,
      first_goal_team: d.first_goal_team,
      last_goal_team: d.last_goal_team,
      extra_time: prec?.extra_time ?? null,
      note: prec?.note ?? null,
    }
    const { error: dbError } = await createClient().from('risultati').upsert(payload, { onConflict: 'schedina_id' })
    setSaving(false)
    if (dbError) { setError('Non salvato: ' + dbError.message); return false }
    setSavedAt(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Rome' }))
    router.refresh()
    return true
  }

  async function aggiungiGol(key: string, team: string) {
    if (!schedina) return
    const m = parseMinute(minuto[key] ?? '')
    if (!m) { setError('Minuto non valido: scrivi 23, oppure 45+2 / 90+3 per il recupero.'); return }
    const st = stato[key]
    const min = formatMinute(m)
    const next = { ...stato, [key]: { gol: [...st.gol, { min, team }], stato: st.stato === 'da_giocare' ? 'in_corso' as const : st.stato } }
    setMinuto(v => ({ ...v, [key]: '' }))
    // La notifica parte solo dopo il salvataggio: il server legge il punteggio aggiornato dal database.
    if (await salva(next) && notifiche) {
      const p = schedina.partite.find(x => matchKey(x) === key)!
      setEsitoPush(`${min} ${team}: ` + await inviaPush({ tipo: 'gol', schedina_id: schedina.id, gol: { home: p.home, away: p.away, min, team } }))
    }
  }

  function togliGol(key: string, idx: number) {
    const g = stato[key].gol[idx]
    if (!window.confirm(`Togliere il gol di ${g.team} al ${g.min}?`)) return
    salva({ ...stato, [key]: { ...stato[key], gol: stato[key].gol.filter((_, i) => i !== idx) } })
  }

  async function cambiaStato(key: string, s: StatoPartita) {
    if (!schedina) return
    const prima = derivato(stato)?.completa
    const next = { ...stato, [key]: { ...stato[key], stato: s } }
    const ok = await salva(next)
    // Ultima partita finita: la classifica è definitiva, si può dire a ciascuno com'è andata.
    if (ok && notifiche && !prima && derivato(next)?.completa
      && window.confirm('Tutte le partite sono finite. Inviare a ogni giocatore punti e posizione finale?')) {
      setEsitoPush('Fine giornata: ' + await inviaPush({ tipo: 'finale', schedina_id: schedina.id }))
    }
  }

  const riepilogo = derivato(stato)

  return (
    <div>
      <p className="text-[var(--muted)] text-sm mb-4">
        Durante le partite: scrivi il minuto e tocca la squadra che ha segnato (autogol: la squadra che ne beneficia).
        Ogni tocco salva subito. Chi apre l&apos;app vede punteggi e classifica aggiornati. <strong className="text-white">Una sola persona per schedina</strong>, altrimenti ci si sovrascrive.
      </p>

      <div className="flex flex-wrap gap-2 mb-2">
        {elenco.map(s => (
          <button key={s.id} onClick={() => scegli(s.id)} className={`seg-btn px-3 py-2 text-sm ${selId === s.id ? 'is-active' : ''}`}>
            {nomeBreve(s.nome)}
          </button>
        ))}
      </div>
      <button onClick={() => setMostraArchivio(v => !v)} className="text-xs text-[var(--muted)] hover:text-white mb-5">
        {mostraArchivio ? 'Solo schedine attive' : 'Mostra anche l\'archivio'}
      </button>

      {schedina && riepilogo && (
        <>
          {/* Riepilogo: quello che vale per i punti */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 mb-4 text-sm space-y-1.5 sticky top-14 sm:top-16 z-10 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{riepilogo.finite}/{schedina.partite.length} finite · {riepilogo.inCorso} live</span>
              <span className="text-xs text-[var(--muted)]">
                {saving ? 'Salvataggio…' : savedAt ? `✓ salvato ${savedAt}` : ''}
              </span>
            </div>
            <div className="text-[var(--muted)]">
              Minuti validi: <span className="text-white font-mono">{riepilogo.minuti_gol.map(m => `${m}'`).join(' ') || '—'}</span>
            </div>
            <div className="text-[var(--muted)]">
              Recupero: <span className="text-white">{riepilogo.recupero}</span>
              {' · '}Prima: <span className="text-white">{riepilogo.first_goal_team ?? '—'}</span>
              {' · '}Ultima: <span className="text-white">{riepilogo.last_goal_team ?? '—'}</span>
              {!riepilogo.completa && riepilogo.last_goal_team && <span className="text-[var(--gold)]"> (provvisoria)</span>}
            </div>
            {error && <div className="text-red-300">{error}</div>}
            <label className="flex items-center gap-2 text-xs text-[var(--muted)] pt-1">
              <input type="checkbox" checked={notifiche} onChange={e => setNotifiche(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
              📣 Notifica i giocatori a ogni gol
              {esitoPush && <span className="text-white/80 truncate">· {esitoPush}</span>}
            </label>
          </div>

          <div className="space-y-3">
            {schedina.partite.map(p => {
              const key = matchKey(p)
              const st = stato[key]
              if (!st) return null
              const d = buildDettaglio(p, st.gol, st.stato)
              return (
                <div key={key} className={`rounded-2xl border p-3 ${st.stato === 'in_corso' ? 'border-[var(--accent)]/50 bg-[var(--accent)]/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)] mb-2">
                    <span>{p.competizione ?? ''}{p.ora ? ` · ${p.ora}` : ''}</span>
                    <div className="flex gap-1">
                      {STATI.map(x => (
                        <button key={x.v} onClick={() => cambiaStato(key, x.v)} disabled={saving}
                          className={`px-2 py-1 rounded-md border text-[11px] ${st.stato === x.v ? 'border-[var(--accent)] text-white bg-[var(--accent)]/15' : 'border-white/10'}`}>
                          {x.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-semibold">
                    <Flag team={p.home} className="w-6 h-5 shrink-0" />
                    <span className="flex-1 truncate">{p.home}</span>
                    <span className="font-display font-extrabold text-xl tabular-nums px-2">{d.score}</span>
                    <span className="flex-1 truncate text-right">{p.away}</span>
                    <Flag team={p.away} className="w-6 h-5 shrink-0" />
                  </div>

                  {d.gol.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {d.gol.map((g, i) => (
                        <button key={i} onClick={() => togliGol(key, st.gol.findIndex(x => x.min === g.min && x.team === g.team))} disabled={saving}
                          className="text-[11px] font-mono bg-white/8 hover:bg-red-500/20 text-white/85 px-2 py-1 rounded" title="Tocca per togliere">
                          {g.min} {g.team} ✕
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-1.5 mt-3">
                    <input value={minuto[key] ?? ''} onChange={e => setMinuto(v => ({ ...v, [key]: e.target.value }))}
                      placeholder="min" inputMode="text" className="input-field px-2 py-2.5 text-center font-mono text-sm" />
                    <button onClick={() => aggiungiGol(key, p.home)} disabled={saving || !(minuto[key] ?? '').trim()} className="btn-ghost px-2 py-2.5 text-xs truncate">⚽ {p.home}</button>
                    <button onClick={() => aggiungiGol(key, p.away)} disabled={saving || !(minuto[key] ?? '').trim()} className="btn-ghost px-2 py-2.5 text-xs truncate">⚽ {p.away}</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
      {!schedina && <p className="text-[var(--muted)] text-sm">Nessuna schedina attiva.</p>}
    </div>
  )
}
