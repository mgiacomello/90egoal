'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Risultato, Schedina, MatchDetail } from '@/lib/types'
import { buildDettaglio, deriveRisultato, matchKey, parseMinute, formatMinute, type GolLive, type StatoPartita } from '@/lib/live'
import { nomeBreve } from '@/lib/teams'
import { quandoPartita } from '@/lib/giornata'
import Flag from '@/components/Flag'
import { inviaPush } from '@/components/AdminPush'

interface Props {
  schedine: Schedina[]
  risultatiMap: Record<number, Risultato>
}

// manuale: la partita è stata toccata a mano, i risultati automatici non la sovrascrivono.
type Stato = Record<string, { gol: GolLive[]; stato: StatoPartita; manuale?: boolean }>

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
      manuale: !!d?.manuale,
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
  const [marcatore, setMarcatore] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notifiche, setNotifiche] = useState(true)
  const [esitoPush, setEsitoPush] = useState('')
  const [esitoAuto, setEsitoAuto] = useState('')
  const [aggiorno, setAggiorno] = useState(false)

  function scegli(id: number) {
    const s = schedine.find(x => x.id === id)
    if (!s) return
    setSelId(id)
    setStato(statoIniziale(s, risultatiMap[id]))
    setMinuto({})
    setMarcatore({})
    setSavedAt(null)
    setError('')
    setEsitoAuto('')
  }

  const conSegno = (p: Schedina['partite'][number], st: Stato[string]) =>
    ({ ...buildDettaglio(p, st.gol, st.stato), ...(st.manuale ? { manuale: true } : {}) })

  function derivato(st: Stato) {
    if (!schedina) return null
    const dettagli = schedina.partite
      .filter(p => st[matchKey(p)] && (st[matchKey(p)].stato !== 'da_giocare' || st[matchKey(p)].gol.length > 0))
      .map(p => buildDettaglio(p, st[matchKey(p)].gol, st[matchKey(p)].stato))
    return deriveRisultato(schedina.partite, dettagli)
  }

  // `toccata`: la partita su cui l'admin ha appena agito, che vale sempre come è qui.
  async function salva(proposto: Stato, toccata?: string): Promise<boolean> {
    if (!schedina) return false
    setSaving(true)
    setError('')
    const sb = createClient()
    // I risultati automatici scrivono mentre il pannello è aperto: prima di salvare si
    // rilegge il database. Le partite toccate a mano valgono come sono qui, le altre
    // come sono là, così un gol inserito a mano non cancella quelli arrivati da soli.
    const { data: fresco } = await sb.from('risultati').select('*').eq('schedina_id', schedina.id).maybeSingle()
    const inDb = statoIniziale(schedina, (fresco as Risultato | null) ?? undefined)
    const next: Stato = {}
    for (const p of schedina.partite) {
      const k = matchKey(p)
      next[k] = k === toccata || proposto[k]?.manuale || !fresco ? proposto[k] : inDb[k]
    }
    setStato(next)
    const dettagli = schedina.partite
      .map(p => ({ p, st: next[matchKey(p)] }))
      .filter(({ st }) => st && (st.stato !== 'da_giocare' || st.gol.length > 0))
      .map(({ p, st }) => conSegno(p, st))
    const d = deriveRisultato(schedina.partite, dettagli)
    const prec = (fresco as Risultato | null) ?? risultatiMap[schedina.id]
    const payload = {
      schedina_id: schedina.id,
      dettagli,
      minuti_gol: d.minuti_gol,
      recupero: d.recupero,
      first_goal_team: d.first_goal_team,
      last_goal_team: d.last_goal_team,
      minuto_primo_gol: d.minuto_primo_gol,
      minuto_ultimo_gol: d.minuto_ultimo_gol,
      extra_time: prec?.extra_time ?? null,
      note: prec?.note ?? null,
    }
    const { error: dbError } = await sb.from('risultati').upsert(payload, { onConflict: 'schedina_id' })
    setSaving(false)
    if (dbError) { setError('Non salvato: ' + dbError.message); return false }
    setSavedAt(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Rome' }))
    router.refresh()
    return true
  }

  // Chiede subito un giro ai risultati automatici per questa schedina (anche se è vecchia)
  // e ricarica quello che ne esce.
  async function aggiornaDaiRisultati() {
    if (!schedina) return
    setAggiorno(true)
    setError('')
    setEsitoAuto('')
    try {
      const res = await fetch(`/api/risultati/sync?schedina=${schedina.id}`, { cache: 'no-store' })
      const j = await res.json()
      const e = j.schedine?.[0]
      if (!res.ok || j.errore || !e) setError(j.errore ?? j.error ?? 'Nessun aggiornamento: la schedina non è ancora cominciata.')
      else setEsitoAuto([
        `${e.abbinate}/${schedina.partite.length} partite trovate`,
        e.nonTrovate.length ? `da inserire a mano: ${e.nonTrovate.join(', ')}` : '',
        e.daControllare.length ? `da controllare: ${e.daControllare.join('; ')}` : '',
      ].filter(Boolean).join(' · '))
      const { data: fresco } = await createClient().from('risultati').select('*').eq('schedina_id', schedina.id).maybeSingle()
      setStato(statoIniziale(schedina, (fresco as Risultato | null) ?? undefined))
      router.refresh()
    } catch {
      setError('Risultati automatici non raggiungibili. Riprova fra poco.')
    }
    setAggiorno(false)
  }

  // Toglie il segno "a mano": al prossimo giro la partita torna a seguire i risultati veri.
  function tornaAutomatica(key: string) {
    salva({ ...stato, [key]: { ...stato[key], manuale: false } }, key)
  }

  async function aggiungiGol(key: string, team: string) {
    if (!schedina) return
    const m = parseMinute(minuto[key] ?? '')
    if (!m) { setError('Minuto non valido: scrivi 23, oppure 45+2 / 90+3 per il recupero.'); return }
    const st = stato[key]
    const min = formatMinute(m)
    const scorer = (marcatore[key] ?? '').trim().slice(0, 40) || undefined
    const gol = scorer ? { min, team, scorer } : { min, team }
    const next = { ...stato, [key]: { gol: [...st.gol, gol], stato: st.stato === 'da_giocare' ? 'in_corso' as const : st.stato, manuale: true } }
    setMinuto(v => ({ ...v, [key]: '' }))
    setMarcatore(v => ({ ...v, [key]: '' }))
    // La notifica parte solo dopo il salvataggio: il server legge il punteggio aggiornato dal database.
    if (await salva(next) && notifiche) {
      const p = schedina.partite.find(x => matchKey(x) === key)!
      setEsitoPush(`${min} ${team}: ` + await inviaPush({ tipo: 'gol', schedina_id: schedina.id, gol: { home: p.home, away: p.away, min, team, scorer } }))
    }
  }

  function togliGol(key: string, idx: number) {
    const g = stato[key].gol[idx]
    if (!window.confirm(`Togliere il gol di ${g.team} al ${g.min}?`)) return
    salva({ ...stato, [key]: { ...stato[key], gol: stato[key].gol.filter((_, i) => i !== idx), manuale: true } })
  }

  async function cambiaStato(key: string, s: StatoPartita) {
    if (!schedina) return
    const prima = derivato(stato)?.completa
    const next = { ...stato, [key]: { ...stato[key], stato: s, manuale: true } }
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
        I gol di Serie A, B e C arrivano da soli, circa ogni minuto, mentre si gioca. Qui si corregge o si completa:
        scrivi il minuto e tocca la squadra che ha segnato (autogol: la squadra che ne beneficia). Ogni tocco salva subito.
        Una partita toccata a mano resta com&apos;è finché non la rimetti in automatico.
      </p>

      <div className="flex flex-wrap gap-2 mb-2">
        {elenco.map(s => (
          <button key={s.id} onClick={() => scegli(s.id)} className={`seg-btn px-3 py-2 text-sm ${selId === s.id ? 'is-active' : ''}`}>
            {nomeBreve(s.nome)}
          </button>
        ))}
      </div>
      <button onClick={() => setMostraArchivio(v => !v)} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] mb-5">
        {mostraArchivio ? 'Solo schedine attive' : 'Mostra anche l\'archivio'}
      </button>

      {schedina && riepilogo && (
        <>
          {/* Riepilogo: quello che vale per i punti */}
          <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] p-4 mb-4 text-sm space-y-1.5 sticky top-14 sm:top-16 z-10 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{riepilogo.finite}/{schedina.partite.length} finite · {riepilogo.inCorso} live</span>
              <span className="text-xs text-[var(--muted)]">
                {saving ? 'Salvataggio…' : savedAt ? `✓ salvato ${savedAt}` : ''}
              </span>
            </div>
            <div className="text-[var(--muted)]">
              Minuti validi: <span className="text-[var(--ink)] font-mono">{riepilogo.minuti_gol.map(m => `${m}'`).join(' ') || '—'}</span>
            </div>
            <div className="text-[var(--muted)]">
              Recupero: <span className="text-[var(--ink)]">{riepilogo.recupero}</span>
              {' · '}Prima: <span className="text-[var(--ink)]">{riepilogo.first_goal_team ?? '—'}</span>
              {' · '}Ultima: <span className="text-[var(--ink)]">{riepilogo.last_goal_team ?? '—'}</span>
              {!riepilogo.completa && riepilogo.last_goal_team && <span className="text-[var(--gold)]"> (provvisoria)</span>}
            </div>
            <div className="text-[var(--muted)]">
              Vale doppio: <span className="text-[var(--ink)] font-mono">{riepilogo.minuto_primo_gol !== null ? `${riepilogo.minuto_primo_gol}'` : '—'}</span>
            </div>
            {error && <div className="text-[var(--danger)]">{error}</div>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button onClick={aggiornaDaiRisultati} disabled={aggiorno || saving} className="btn-ghost px-3 py-1.5 text-xs">
                {aggiorno ? 'Aggiorno…' : '↻ Aggiorna dai risultati veri'}
              </button>
              {esitoAuto && <span className="text-xs text-[var(--muted)]">{esitoAuto}</span>}
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)] pt-1">
              <input type="checkbox" checked={notifiche} onChange={e => setNotifiche(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
              📣 Notifica i giocatori a ogni gol
              {esitoPush && <span className="text-[var(--ink)] truncate">· {esitoPush}</span>}
            </label>
          </div>

          <div className="space-y-3">
            {schedina.partite.map(p => {
              const key = matchKey(p)
              const st = stato[key]
              if (!st) return null
              const d = buildDettaglio(p, st.gol, st.stato)
              return (
                <div key={key} className={`rounded-2xl border p-3 ${st.stato === 'in_corso' ? 'border-[var(--accent)]/50 bg-[var(--accent)]/[0.06]' : 'border-[var(--line)] bg-[var(--surface-2)]'}`}>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--muted)] mb-2">
                    <span>
                      {p.competizione ?? ''}{quandoPartita(p, schedina.partite) ? ` · ${quandoPartita(p, schedina.partite)}` : ''}
                      {st.manuale && (
                        <button onClick={() => tornaAutomatica(key)} disabled={saving} className="ml-2 text-[var(--gold)] underline" title="Torna a seguire i risultati automatici">
                          a mano · rimetti automatica
                        </button>
                      )}
                    </span>
                    <div className="flex gap-1">
                      {STATI.map(x => (
                        <button key={x.v} onClick={() => cambiaStato(key, x.v)} disabled={saving}
                          className={`px-2 py-1 rounded-md border text-[11px] ${st.stato === x.v ? 'border-[var(--accent)] text-[var(--ink)] bg-[var(--accent)]/15' : 'border-[var(--line)]'}`}>
                          {x.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-semibold">
                    <Flag team={p.home} className="w-6 h-5 shrink-0" />
                    <span className="flex-1 truncate">{p.home}</span>
                    <span className="font-num font-semibold text-xl tabular-nums px-2">{d.score}</span>
                    <span className="flex-1 truncate text-right">{p.away}</span>
                    <Flag team={p.away} className="w-6 h-5 shrink-0" />
                  </div>

                  {d.gol.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {d.gol.map((g, i) => (
                        <button key={i} onClick={() => togliGol(key, st.gol.findIndex(x => x.min === g.min && x.team === g.team))} disabled={saving}
                          className="text-[11px] font-mono bg-[var(--surface-2)] hover:bg-[var(--danger-soft)] text-[var(--ink)] px-2 py-1 rounded" title="Tocca per togliere">
                          {g.min} {g.team}{g.scorer ? ` · ${g.scorer}` : ''} ✕
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
                  <input value={marcatore[key] ?? ''} onChange={e => setMarcatore(v => ({ ...v, [key]: e.target.value }))}
                    placeholder="Marcatore e numero, facoltativo (es. Lukaku 11)" className="input-field w-full px-3 py-2 text-sm mt-1.5" />
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
