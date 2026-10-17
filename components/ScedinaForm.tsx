'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Schedina, Pronostico, Partita } from '@/lib/types'
import { GoalStats, TeamGoalStats } from '@/lib/goalStats'
import Flag from '@/components/Flag'
import TeamPicker from '@/components/TeamPicker'
import GoalStatsPanel from '@/components/GoalStatsPanel'
import { logEvent } from '@/lib/track'
import { nomeBreve } from '@/lib/teams'
import { PROVA_KEY, type PronosticoProva } from '@/lib/demo'
import PushToggle from '@/components/PushToggle'
import { IconPlus, IconWhistle, IconFlag, IconStopwatch, IconChart, IconLock, IconCheck } from '@/components/Icons'

const MAX_MINUTI = 13

// Si gioca col telefono in mano: un passo alla volta, una cosa sola per schermo,
// il pulsante per andare avanti sempre sotto al pollice.
type Passo = 'minuti' | 'bonus' | 'conferma'

interface Props {
  schedina: Schedina
  pronosticoEsistente: Pronostico | null
  userId: string
  goalStats?: GoalStats
  teamStats?: TeamGoalStats[]
  guest?: boolean              // senza account: la schedina resta nel telefono
  onGuestSaved?: () => void
}

export default function ScedinaForm({ schedina, pronosticoEsistente, userId, goalStats, teamStats, guest, onGuestSaved }: Props) {
  const router = useRouter()
  const isKnockout = schedina.fase === 'eliminazione'

  const [passo, setPasso] = useState<Passo>('minuti')
  const [minuti, setMinuti] = useState<number[]>(pronosticoEsistente?.minuti ?? [])
  const [recupero, setRecupero] = useState<'primo' | 'secondo' | null>(pronosticoEsistente?.recupero ?? null)
  const [firstGoal, setFirstGoal] = useState<string>(pronosticoEsistente?.first_goal ?? '')
  const [lastGoal, setLastGoal] = useState<string>(pronosticoEsistente?.last_goal ?? '')
  const [extraTime, setExtraTime] = useState<boolean | null>(pronosticoEsistente?.extra_time ?? null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // --- Tracciamento tempi (per le statistiche admin) ---
  const openedAt = useRef<number>(0)
  const marked = useRef<Set<string>>(new Set())
  function mark(name: string) {
    if (marked.current.has(name)) return
    marked.current.add(name)
    logEvent(name, { schedina_id: schedina.id, ms: Date.now() - openedAt.current })
  }
  useEffect(() => {
    openedAt.current = Date.now()
    logEvent('form_open', { schedina_id: schedina.id })
  }, [schedina.id])
  useEffect(() => { if (minuti.length === MAX_MINUTI) mark('minutes_done') }, [minuti])
  useEffect(() => { if (recupero) mark('recupero_set') }, [recupero])
  useEffect(() => { if (firstGoal) mark('first_team_set') }, [firstGoal])
  useEffect(() => { if (lastGoal) mark('last_team_set') }, [lastGoal])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [passo])

  const completo = minuti.length === MAX_MINUTI
  const mancano = MAX_MINUTI - minuti.length

  function toggleMinuto(m: number) {
    setError('')
    if (minuti.includes(m)) setMinuti(prev => prev.filter(x => x !== m))
    else if (!completo) setMinuti(prev => [...prev, m].sort((a, b) => a - b))
  }

  async function invia() {
    setError('')
    if (!completo) { setPasso('minuti'); return }
    if (guest) {
      const prova: PronosticoProva = {
        schedina_id: schedina.id, nome: nomeBreve(schedina.nome), minuti,
        recupero: recupero ?? null, first_goal: firstGoal || null, last_goal: lastGoal || null,
        salvato_il: new Date().toISOString(),
      }
      try { localStorage.setItem(PROVA_KEY, JSON.stringify(prova)) } catch {}
      setSaved(true)
      setTimeout(() => { onGuestSaved?.(); router.push('/prova') }, 1600)
      return
    }
    setSaving(true)
    const payload = {
      user_id: userId,
      schedina_id: schedina.id,
      minuti,
      recupero: recupero ?? null,
      first_goal: firstGoal || null,
      last_goal: lastGoal || null,
      extra_time: isKnockout ? extraTime : null,
    }
    const { error: dbError } = await createClient().from('pronostici').insert(payload)
    if (dbError) {
      setError(new Date() > new Date(schedina.deadline) ? 'La schedina è chiusa: il calcio d\'inizio è già passato.' : 'Errore nell\'invio. Riprova.')
    } else {
      logEvent('submit', { schedina_id: schedina.id, ms: Date.now() - openedAt.current })
      setSaved(true)
      setTimeout(() => router.push('/'), 6000)
    }
    setSaving(false)
  }

  if (saved) {
    return (
      <div className="animate-fade-up pt-10 space-y-6">
        <div className="text-center">
          <div className="inline-grid place-items-center w-20 h-20 rounded-3xl bg-[var(--accent)] text-[var(--accent-ink)] mb-5"><IconCheck size={40} strokeWidth={2.6} /></div>
          <h2 className="font-display font-bold text-3xl">{guest ? 'Schedina salvata' : 'Schedina giocata'}</h2>
          <p className="text-[var(--muted)] mt-2">{guest ? 'Resta su questo telefono. Con un account entra in classifica.' : 'Ora tocca al campo. Durante le partite i tuoi minuti si accendono qui.'}</p>
        </div>
        {!guest && <PushToggle variant="banner" testo="Ti avviso io quando esce un tuo minuto." />}
      </div>
    )
  }

  const deadline = new Date(schedina.deadline)
  const nPassi: Passo[] = ['minuti', 'bonus', 'conferma']
  const idx = nPassi.indexOf(passo)

  return (
    <>
    <div className="max-w-lg mx-auto animate-fade-up pb-28">
      {/* Testata essenziale: nome, scadenza, passo */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button type="button" onClick={() => (idx > 0 ? setPasso(nPassi[idx - 1]) : router.push('/'))}
          className="text-sm text-[var(--muted)] hover:text-white -ml-1 px-1 py-1">← {idx > 0 ? 'Indietro' : 'Esci'}</button>
        <div className="flex gap-1.5">
          {nPassi.map((p, i) => (
            <span key={p} className={`h-1.5 rounded-full transition-all ${i <= idx ? 'w-6 bg-[var(--accent)]' : 'w-3 bg-white/15'}`} />
          ))}
        </div>
      </div>
      <h1 className="font-display font-bold text-2xl leading-tight">{nomeBreve(schedina.nome)}</h1>
      <p className="text-xs text-[var(--muted)] mt-1 mb-5">
        Si chiude {deadline.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })} alle {deadline.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}
      </p>

      {/* ===== PASSO 1: i minuti ===== */}
      {passo === 'minuti' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display font-bold text-xl">In quali minuti si segna?</h2>
            <p className="text-sm text-[var(--muted)] mt-1">Scegline {MAX_MINUTI}. Vale un gol in una qualsiasi delle {schedina.partite.length} partite.</p>
          </div>

          {(['primo', 'secondo'] as const).map(tempo => (
            <div key={tempo}>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-display font-semibold uppercase tracking-wider text-xs text-[var(--muted)]">{tempo === 'primo' ? 'Primo tempo' : 'Secondo tempo'}</span>
                <span className="flex-1 h-px bg-[var(--line)]" />
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 45 }, (_, i) => i + 1 + (tempo === 'primo' ? 0 : 45)).map(m => {
                  const selected = minuti.includes(m)
                  return (
                    <button key={m} type="button" onClick={() => toggleMinuto(m)} disabled={!selected && completo}
                      className={`min-cell ${selected ? 'is-selected' : ''}`}>
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <details className="glass rounded-xl overflow-hidden group">
            <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-3 text-sm select-none">
              <span className="text-[var(--ink)]/85">Le {schedina.partite.length} partite</span>
              <span className="text-[var(--muted)] text-xs transition-transform group-open:rotate-90">▶</span>
            </summary>
            <div className="px-4 pb-3 space-y-1.5">
              {schedina.partite.map((p: Partita, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-[11px] text-[var(--muted)] w-10 shrink-0 tabular-nums">{p.ora ?? ''}</span>
                  <Flag team={p.home} w={40} className="w-5 h-3.5 shrink-0" />
                  <span className="truncate">{p.home}</span>
                  <span className="text-[var(--muted)] text-xs">–</span>
                  <Flag team={p.away} w={40} className="w-5 h-3.5 shrink-0" />
                  <span className="truncate">{p.away}</span>
                </div>
              ))}
            </div>
          </details>

          {goalStats && (
            <details className="glass rounded-xl overflow-hidden group">
              <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-3 text-sm select-none">
                <span className="text-[var(--ink)]/85 flex items-center gap-2"><IconChart size={16} className="text-[var(--muted)]" /> Quando si è segnato finora</span>
                <span className="text-[var(--muted)] text-xs transition-transform group-open:rotate-90">▶</span>
              </summary>
              <div className="px-2 pb-2"><GoalStatsPanel stats={goalStats} teamStats={teamStats} /></div>
            </details>
          )}
        </div>
      )}

      {/* ===== PASSO 2: i bonus (facoltativi) ===== */}
      {passo === 'bonus' && (
        <div className="space-y-7">
          <div>
            <h2 className="font-display font-bold text-lg">Tre bonus, se te la senti</h2>
            <p className="text-sm text-[var(--muted)] mt-1">Puoi anche saltarli: i tuoi {MAX_MINUTI} minuti sono già salvi.</p>
          </div>

          <section>
            <h3 className="font-semibold mb-0.5 flex items-center gap-2"><IconPlus size={16} className="text-[var(--gold)]" /> Gol nel recupero <span className="text-xs font-normal text-[var(--gold)]">+1</span></h3>
            <p className="text-xs text-[var(--muted)] mb-3">Un gol oltre il 45&apos; o oltre il 90&apos;, in una partita qualsiasi.</p>
            <div className="grid grid-cols-2 gap-2">
              {(['primo', 'secondo'] as const).map(t => (
                <button key={t} type="button" onClick={() => setRecupero(recupero === t ? null : t)}
                  className={`seg-btn px-4 py-3.5 text-sm ${recupero === t ? 'is-active' : ''}`}>
                  {t === 'primo' ? '1° tempo' : '2° tempo'}
                </button>
              ))}
            </div>
          </section>

          {isKnockout && (
            <section>
              <h3 className="font-semibold mb-0.5 flex items-center gap-2"><IconStopwatch size={16} className="text-[var(--gold)]" /> Supplementari <span className="text-xs font-normal text-[var(--gold)]">+5</span></h3>
              <p className="text-xs text-[var(--muted)] mb-3">Almeno una partita va oltre i 90&apos;?</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setExtraTime(extraTime === true ? null : true)} className={`seg-btn px-4 py-3.5 text-sm ${extraTime === true ? 'is-active' : ''}`}>Sì</button>
                <button type="button" onClick={() => setExtraTime(extraTime === false ? null : false)} className={`seg-btn px-4 py-3.5 text-sm ${extraTime === false ? 'is-active' : ''}`}>No</button>
              </div>
            </section>
          )}

          <section>
            <h3 className="font-semibold mb-0.5 flex items-center gap-2"><IconWhistle size={16} className="text-[var(--gold)]" /> Chi segna per primo <span className="text-xs font-normal text-[var(--gold)]">+3</span></h3>
            <p className="text-xs text-[var(--muted)] mb-3">Il primo gol di tutta la giornata, in ordine di orario.</p>
            <TeamPicker partite={schedina.partite} value={firstGoal} onChange={setFirstGoal} />
          </section>

          <section>
            <h3 className="font-semibold mb-0.5 flex items-center gap-2"><IconFlag size={16} className="text-[var(--gold)]" /> Chi segna per ultimo <span className="text-xs font-normal text-[var(--gold)]">+3 · entrambe +10</span></h3>
            <p className="text-xs text-[var(--muted)] mb-3">L&apos;ultimo gol della giornata.</p>
            <TeamPicker partite={schedina.partite} value={lastGoal} onChange={setLastGoal} />
          </section>
        </div>
      )}

      {/* ===== PASSO 3: conferma ===== */}
      {passo === 'conferma' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display font-bold text-lg">Tutto giusto?</h2>
            <p className="text-sm text-[var(--muted)] mt-1">Dopo l&apos;invio non si cambia più.</p>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">I tuoi {MAX_MINUTI} minuti</span>
              <button type="button" onClick={() => setPasso('minuti')} className="text-xs text-[var(--accent-soft)]">Cambia</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {minuti.map(m => <span key={m} className="tag-static px-2.5 py-1.5 text-sm">{m}&apos;</span>)}
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Bonus</span>
              <button type="button" onClick={() => setPasso('bonus')} className="text-xs text-[var(--accent-soft)]">Cambia</button>
            </div>
            {!recupero && !firstGoal && !lastGoal && extraTime == null ? (
              <p className="text-sm text-[var(--muted)]">Nessuno. Va benissimo così.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {recupero && <div className="flex items-center gap-2"><IconPlus size={14} className="text-[var(--gold)]" /> Recupero <span className="font-medium">{recupero === 'primo' ? '1° tempo' : '2° tempo'}</span></div>}
                {extraTime != null && <div className="flex items-center gap-2"><IconStopwatch size={14} className="text-[var(--gold)]" /> Supplementari: <span className="font-medium">{extraTime ? 'Sì' : 'No'}</span></div>}
                {firstGoal && <div className="flex items-center gap-2"><IconWhistle size={14} className="text-[var(--gold)]" /> Primo gol: <Flag team={firstGoal} w={40} className="w-5 h-3.5" /> <span className="font-medium">{firstGoal}</span></div>}
                {lastGoal && <div className="flex items-center gap-2"><IconFlag size={14} className="text-[var(--gold)]" /> Ultimo gol: <Flag team={lastGoal} w={40} className="w-5 h-3.5" /> <span className="font-medium">{lastGoal}</span></div>}
              </div>
            )}
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>}
        </div>
      )}

    </div>

      {/* ===== Barra sotto al pollice (fuori dal blocco animato: un antenato con transform romperebbe il fixed) ===== */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[rgba(7,26,18,0.96)] backdrop-blur-md pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 px-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {passo === 'minuti' && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <div className={`font-display font-extrabold text-2xl tabular-nums leading-none ${completo ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>{minuti.length}<span className="text-sm text-[var(--muted)] font-normal">/{MAX_MINUTI}</span></div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5">{completo ? 'fatto' : `ancora ${mancano}`}</div>
                </div>
                <button type="button" disabled={!completo} onClick={() => setPasso('bonus')} className="btn-primary flex-1 py-3.5 text-base">Avanti →</button>
              </div>
              {minuti.length > 0 && (
                <div className="flex gap-1 mt-2 overflow-x-auto [scrollbar-width:none]">
                  {minuti.map(m => (
                    <button key={m} type="button" onClick={() => toggleMinuto(m)} className="tag-static px-1.5 py-0.5 text-[11px] shrink-0" title="Tocca per togliere">{m}&apos;</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {passo === 'bonus' && (
            <>
              <button type="button" onClick={() => { setRecupero(null); setFirstGoal(''); setLastGoal(''); setExtraTime(null); setPasso('conferma') }} className="btn-ghost px-5 py-3.5 text-sm">Salta</button>
              <button type="button" onClick={() => setPasso('conferma')} className="btn-primary flex-1 py-3.5 text-base">Avanti →</button>
            </>
          )}
          {passo === 'conferma' && (
            <button type="button" disabled={saving} onClick={invia} className="btn-primary flex-1 py-4 text-base">
              {saving ? 'Invio…' : <><IconLock size={18} className="mr-2" /> Gioca la schedina</>}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
