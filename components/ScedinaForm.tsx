'use client'

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Schedina, Pronostico, Partita } from '@/lib/types'
import { GoalStats, TeamGoalStats, caloreMinuto } from '@/lib/goalStats'
import Flag from '@/components/Flag'
import TeamPicker from '@/components/TeamPicker'
import GoalStatsPanel from '@/components/GoalStatsPanel'
import { logEvent } from '@/lib/track'
import { nomeBreve } from '@/lib/teams'
import { PROVA_KEY, type PronosticoProva } from '@/lib/demo'
import { quandoPartita, suPiuGiorni } from '@/lib/giornata'
import PushToggle from '@/components/PushToggle'
import { useLingua, useTx } from '@/components/Lingua'
import { localeDi, nomeSchedina } from '@/lib/lingua'
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
  const tx = useTx()
  const lingua = useLingua()
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
  // Minuti caldi: spenti di default (la griglia resta pulita per chi gioca d'istinto),
  // ricordati sul telefono per chi studia.
  const conDati = !!goalStats && goalStats.maxPerMinute > 0
  const caldiSalvati = useSyncExternalStore(() => () => {}, () => { try { return localStorage.getItem('minuti_caldi') === '1' } catch { return false } }, () => false)
  const [caldiScelti, setCaldi] = useState<boolean | null>(null)
  const caldi = caldiScelti ?? caldiSalvati
  const [ultimo, setUltimo] = useState<number | null>(null)
  function cambiaCaldi() {
    const v = !caldi
    setCaldi(v)
    setUltimo(null)
    try { localStorage.setItem('minuti_caldi', v ? '1' : '0') } catch {}
    logEvent(v ? 'stats_on' : 'stats_off', { schedina_id: schedina.id })
  }

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
    if (minuti.includes(m)) { setMinuti(prev => prev.filter(x => x !== m)); setUltimo(null) }
    else if (!completo) { setMinuti(prev => [...prev, m].sort((a, b) => a - b)); setUltimo(m) }
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
      setError(new Date() > new Date(schedina.deadline) ? tx('La schedina è chiusa: il calcio d\'inizio è già passato.', 'The ticket is closed: kick-off has already passed.') : tx('Errore nell\'invio. Riprova.', 'Something went wrong while sending. Try again.'))
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
          <div className="inline-grid place-items-center w-20 h-20 rounded-3xl bg-[var(--ink)] text-[var(--bg)] mb-5"><IconCheck size={40} strokeWidth={2.6} /></div>
          <h2 className="font-display font-bold text-3xl">{guest ? tx('Schedina salvata', 'Ticket saved') : tx('Schedina giocata', 'Ticket played')}</h2>
          <p className="text-[var(--muted)] mt-2">{guest ? tx('Resta su questo telefono. Con un account entra in classifica.', 'It stays on this phone. With an account it enters the standings.') : tx('Ora tocca al campo. Durante le partite i tuoi minuti si accendono qui.', 'Now it\'s up to the pitch. During the matches your minutes light up here.')}</p>
        </div>
        {!guest && <PushToggle variant="banner" testo={tx('Ti avviso io quando esce un tuo minuto.', 'I\'ll let you know when one of your minutes comes up.')} />}
      </div>
    )
  }

  const deadline = new Date(schedina.deadline)
  // Per i bonus squadra: chi segna di più fra le squadre in campo in questa schedina.
  const inCampo = new Set(schedina.partite.flatMap((p: Partita) => [p.home, p.away]))
  const bomber = (teamStats ?? []).filter(t => inCampo.has(t.team)).slice(0, 3)
  const nPassi: Passo[] = ['minuti', 'bonus', 'conferma']
  const idx = nPassi.indexOf(passo)

  return (
    <>
    <div className="max-w-lg mx-auto animate-fade-up pb-28">
      {/* Testata essenziale: nome, scadenza, passo */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button type="button" onClick={() => (idx > 0 ? setPasso(nPassi[idx - 1]) : router.push('/'))}
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)] -ml-1 px-1 py-1">← {idx > 0 ? tx('Indietro', 'Back') : tx('Esci', 'Exit')}</button>
        <div className="flex gap-1.5">
          {nPassi.map((p, i) => (
            <span key={p} className={`h-1.5 rounded-full transition-all ${i <= idx ? 'w-6 bg-[var(--accent)]' : 'w-3 bg-[var(--surface-2)]'}`} />
          ))}
        </div>
      </div>
      <h1 className="font-display font-bold text-2xl leading-tight">{nomeSchedina(nomeBreve(schedina.nome), lingua)}</h1>
      <p className="text-xs text-[var(--muted)] mt-1 mb-5">
        {tx('Si chiude', 'Closes')} {deadline.toLocaleDateString(localeDi(lingua), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })} {tx('alle', 'at')} {deadline.toLocaleTimeString(localeDi(lingua), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}
      </p>

      {/* ===== PASSO 1: i minuti ===== */}
      {passo === 'minuti' && (
        <div className="space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display font-bold text-xl">{tx('In quali minuti si segna?', 'In which minutes will goals come?')}</h2>
              {conDati && (
                <button type="button" onClick={cambiaCaldi} aria-pressed={caldi}
                  className={`seg-btn shrink-0 px-2.5 py-1 text-xs flex items-center gap-1.5 ${caldi ? 'is-active' : ''}`}>
                  <IconChart size={14} /> {tx('Minuti caldi', 'Hot minutes')}
                </button>
              )}
            </div>
            <p className="text-sm text-[var(--muted)] mt-1">{tx(`Scegline ${MAX_MINUTI}. Vale un gol in una qualsiasi delle ${schedina.partite.length} partite.`, `Pick ${MAX_MINUTI}. A goal in any of the ${schedina.partite.length} matches counts.`)}</p>
            {caldi && goalStats && (
              <p className="text-xs text-[var(--ink)] mt-2 leading-snug" aria-live="polite">
                {ultimo != null
                  ? (goalStats.perMinute[ultimo] ?? 0) === 0
                    ? lingua === 'en'
                      ? <>Minute <strong>{ultimo}&apos;</strong> hasn&apos;t come up yet in {goalStats.matches} matches.</>
                      : <>Il <strong>{ultimo}&apos;</strong> non è ancora uscito in {goalStats.matches} partite.</>
                    : lingua === 'en'
                      ? <>Minute <strong>{ultimo}&apos;</strong> has come up <strong>{goalStats.perMinute[ultimo]}</strong> {goalStats.perMinute[ultimo] === 1 ? 'time' : 'times'} in {goalStats.matches} matches.</>
                      : <>Il <strong>{ultimo}&apos;</strong> è uscito <strong>{goalStats.perMinute[ultimo]}</strong> {goalStats.perMinute[ultimo] === 1 ? 'volta' : 'volte'} in {goalStats.matches} partite.</>
                  : <>{tx('Barretta più alta, più gol in quel minuto.', 'Taller bar, more goals in that minute.')} {goalStats.hottest && <>{tx('Fascia più calda', 'Hottest spell')} <strong>{goalStats.hottest.label}</strong> ({goalStats.hottest.pct}%).</>}</>}
                <span className="text-[var(--muted)]"> · {goalStats.totalGoals} {tx('gol finora', 'goals so far')}</span>
              </p>
            )}
          </div>

          {(['primo', 'secondo'] as const).map(tempo => (
            <div key={tempo}>
              <div className="flex items-center gap-3 mb-2">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-[var(--muted)]">{tempo === 'primo' ? tx('Primo tempo', 'First half') : tx('Secondo tempo', 'Second half')}</span>
                <span className="flex-1 h-px bg-[var(--line)]" />
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 45 }, (_, i) => i + 1 + (tempo === 'primo' ? 0 : 45)).map(m => {
                  const selected = minuti.includes(m)
                  return (
                    <button key={m} type="button" onClick={() => toggleMinuto(m)} disabled={!selected && completo}
                      className={`min-cell ${selected ? 'is-selected' : ''}`}>
                      {m}
                      {caldi && goalStats && caloreMinuto(goalStats, m) > 0 && <span className={`heat h${caloreMinuto(goalStats, m)}`} aria-hidden />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <details className="glass rounded-xl overflow-hidden group">
            <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-3 text-sm select-none">
              <span className="text-[var(--ink)]/85">{tx(`Le ${schedina.partite.length} partite`, `The ${schedina.partite.length} matches`)}</span>
              <span className="text-[var(--muted)] text-xs transition-transform group-open:rotate-90">▶</span>
            </summary>
            <div className="px-4 pb-3 space-y-1.5">
              {schedina.partite.map((p: Partita, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={`text-[11px] text-[var(--muted)] ${suPiuGiorni(schedina.partite) ? 'w-[4.25rem]' : 'w-10'} shrink-0 tabular-nums`}>{quandoPartita(p, schedina.partite, lingua)}</span>
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
                <span className="text-[var(--ink)]/85 flex items-center gap-2"><IconChart size={16} className="text-[var(--muted)]" /> {tx('Quando si è segnato finora', 'When goals have come so far')}</span>
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
            <h2 className="font-display font-bold text-lg">{tx('Tre bonus, se te la senti', 'Three bonuses, if you fancy it')}</h2>
            <p className="text-sm text-[var(--muted)] mt-1">{tx(`Puoi anche saltarli: i tuoi ${MAX_MINUTI} minuti sono già salvi.`, `You can skip them: your ${MAX_MINUTI} minutes are already safe.`)}</p>
          </div>

          <section>
            <h3 className="font-semibold mb-0.5 flex items-center gap-2"><IconPlus size={16} className="text-[var(--gold)]" /> {tx('Gol nel recupero', 'Goal in stoppage time')} <span className="text-xs font-normal text-[var(--gold)]">+1</span></h3>
            <p className="text-xs text-[var(--muted)] mb-3">{tx('Un gol oltre il 45\' o oltre il 90\', in una partita qualsiasi.', 'A goal after the 45th or after the 90th minute, in any match.')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(['primo', 'secondo'] as const).map(t => (
                <button key={t} type="button" onClick={() => setRecupero(recupero === t ? null : t)}
                  className={`seg-btn px-4 py-3.5 text-sm ${recupero === t ? 'is-active' : ''}`}>
                  {t === 'primo' ? tx('1° tempo', '1st half') : tx('2° tempo', '2nd half')}
                </button>
              ))}
            </div>
          </section>

          {isKnockout && (
            <section>
              <h3 className="font-semibold mb-0.5 flex items-center gap-2"><IconStopwatch size={16} className="text-[var(--gold)]" /> {tx('Supplementari', 'Extra time')} <span className="text-xs font-normal text-[var(--gold)]">+5</span></h3>
              <p className="text-xs text-[var(--muted)] mb-3">{tx('Almeno una partita va oltre i 90\'?', 'Will at least one match go beyond 90 minutes?')}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setExtraTime(extraTime === true ? null : true)} className={`seg-btn px-4 py-3.5 text-sm ${extraTime === true ? 'is-active' : ''}`}>{tx('Sì', 'Yes')}</button>
                <button type="button" onClick={() => setExtraTime(extraTime === false ? null : false)} className={`seg-btn px-4 py-3.5 text-sm ${extraTime === false ? 'is-active' : ''}`}>No</button>
              </div>
            </section>
          )}

          <section>
            <h3 className="font-semibold mb-0.5 flex items-center gap-2"><IconWhistle size={16} className="text-[var(--gold)]" /> {tx('Chi segna per primo', 'First team to score')} <span className="text-xs font-normal text-[var(--gold)]">+1</span></h3>
            <p className="text-xs text-[var(--muted)] mb-3">{tx('Il primo gol della giornata nei 90 minuti, in ordine di orario. I gol nel recupero non contano.', 'The matchday\'s first goal within the 90 minutes, in order of real time. Stoppage-time goals don\'t count.')}</p>
            {bomber.length > 0 && (
              <p className="text-xs text-[var(--muted)] -mt-2 mb-3 truncate">
                <IconChart size={12} className="inline -mt-0.5 mr-1" />{tx('Più gol finora:', 'Most goals so far:')} {bomber.map((t, i) => <span key={t.team}>{i > 0 && ' · '}<span className="text-[var(--ink)] font-medium">{t.team}</span> {t.count}</span>)}
              </p>
            )}
            <TeamPicker partite={schedina.partite} value={firstGoal} onChange={setFirstGoal} />
          </section>

          <section>
            <h3 className="font-semibold mb-0.5 flex items-center gap-2"><IconFlag size={16} className="text-[var(--gold)]" /> {tx('Chi segna per ultimo', 'Last team to score')} <span className="text-xs font-normal text-[var(--gold)]">+1</span></h3>
            <p className="text-xs text-[var(--muted)] mb-3">{tx('L\'ultimo gol della giornata nei 90 minuti.', 'The matchday\'s last goal within the 90 minutes.')}</p>
            <TeamPicker partite={schedina.partite} value={lastGoal} onChange={setLastGoal} />
          </section>
        </div>
      )}

      {/* ===== PASSO 3: conferma ===== */}
      {passo === 'conferma' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-display font-bold text-lg">{tx('Tutto giusto?', 'All correct?')}</h2>
            <p className="text-sm text-[var(--muted)] mt-1">{tx('Dopo l\'invio non si cambia più.', 'Once sent, it can\'t be changed.')}</p>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">{tx(`I tuoi ${MAX_MINUTI} minuti`, `Your ${MAX_MINUTI} minutes`)}</span>
              <button type="button" onClick={() => setPasso('minuti')} className="text-xs text-[var(--accent-soft)]">{tx('Cambia', 'Change')}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {minuti.map(m => <span key={m} className="tag-static px-2.5 py-1.5 text-sm">{m}&apos;</span>)}
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Bonus</span>
              <button type="button" onClick={() => setPasso('bonus')} className="text-xs text-[var(--accent-soft)]">{tx('Cambia', 'Change')}</button>
            </div>
            {!recupero && !firstGoal && !lastGoal && extraTime == null ? (
              <p className="text-sm text-[var(--muted)]">{tx('Nessuno. Va benissimo così.', 'None. That\'s perfectly fine.')}</p>
            ) : (
              <div className="space-y-2 text-sm">
                {recupero && <div className="flex items-center gap-2"><IconPlus size={14} className="text-[var(--gold)]" /> {tx('Recupero', 'Stoppage time')} <span className="font-medium">{recupero === 'primo' ? tx('1° tempo', '1st half') : tx('2° tempo', '2nd half')}</span></div>}
                {extraTime != null && <div className="flex items-center gap-2"><IconStopwatch size={14} className="text-[var(--gold)]" /> {tx('Supplementari:', 'Extra time:')} <span className="font-medium">{extraTime ? tx('Sì', 'Yes') : 'No'}</span></div>}
                {firstGoal && <div className="flex items-center gap-2"><IconWhistle size={14} className="text-[var(--gold)]" /> {tx('Primo gol:', 'First goal:')} <Flag team={firstGoal} w={40} className="w-5 h-3.5" /> <span className="font-medium">{firstGoal}</span></div>}
                {lastGoal && <div className="flex items-center gap-2"><IconFlag size={14} className="text-[var(--gold)]" /> {tx('Ultimo gol:', 'Last goal:')} <Flag team={lastGoal} w={40} className="w-5 h-3.5" /> <span className="font-medium">{lastGoal}</span></div>}
              </div>
            )}
          </div>

          {error && <div className="bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] text-sm rounded-xl px-4 py-3">{error}</div>}
        </div>
      )}

    </div>

      {/* ===== Barra sotto al pollice (fuori dal blocco animato: un antenato con transform romperebbe il fixed) ===== */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[var(--line)] bg-[var(--bg-deep)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 px-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {passo === 'minuti' && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  <div className={`font-num font-semibold text-2xl tabular-nums leading-none ${completo ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>{minuti.length}<span className="text-sm text-[var(--muted)] font-normal">/{MAX_MINUTI}</span></div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5">{completo ? tx('fatto', 'done') : tx(`ancora ${mancano}`, `${mancano} to go`)}</div>
                </div>
                <button type="button" disabled={!completo} onClick={() => setPasso('bonus')} className="btn-primary flex-1 py-3.5 text-base">{tx('Avanti →', 'Next →')}</button>
              </div>
              {minuti.length > 0 && (
                <div className="flex gap-1 mt-2 overflow-x-auto [scrollbar-width:none]">
                  {minuti.map(m => (
                    <button key={m} type="button" onClick={() => toggleMinuto(m)} className="tag-static px-1.5 py-0.5 text-[11px] shrink-0" title={tx('Tocca per togliere', 'Tap to remove')}>{m}&apos;</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {passo === 'bonus' && (
            <>
              <button type="button" onClick={() => { setRecupero(null); setFirstGoal(''); setLastGoal(''); setExtraTime(null); setPasso('conferma') }} className="btn-ghost px-5 py-3.5 text-sm">{tx('Salta', 'Skip')}</button>
              <button type="button" onClick={() => setPasso('conferma')} className="btn-primary flex-1 py-3.5 text-base">{tx('Avanti →', 'Next →')}</button>
            </>
          )}
          {passo === 'conferma' && (
            <button type="button" disabled={saving} onClick={invia} className="btn-primary flex-1 py-4 text-base">
              {saving ? tx('Invio…', 'Sending…') : <><IconLock size={18} className="mr-2" /> {tx('Gioca la schedina', 'Play the ticket')}</>}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
