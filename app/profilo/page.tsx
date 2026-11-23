import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClassificaRow, Pronostico, Schedina, Profile } from '@/lib/types'
import LogoutButton from '@/components/LogoutButton'
import PushToggle from '@/components/PushToggle'
import Flag from '@/components/Flag'
import ShareButton from '@/components/ShareButton'
import { nomeBreve } from '@/lib/teams'
import { IconTarget, IconStar, IconCrown, IconBook, IconTrophy } from '@/components/Icons'
import { CambiaLingua } from '@/components/Lingua'
import { txServer } from '@/lib/lingua.server'
import { localeDi, nomeSchedina, nomeTorneo, ordinale } from '@/lib/lingua'

export default async function ProfiloPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { lingua, tx } = await txServer()
  const loc = localeDi(lingua)

  const [{ data: prof }, { data: classifica }, { data: schedine }, { data: mieiPron }] = await Promise.all([
    supabase.from('profiles').select('id, username, full_name, email, created_at').eq('id', user.id).single(),
    supabase.from('classifica').select('*'),
    supabase.from('schedine').select('*').order('id'),
    supabase.from('pronostici').select('*').eq('user_id', user.id),
  ])

  const profile = prof as Profile | null
  // Posizione, punti e badge si contano sul torneo in corso: i Mondiali restano nello storico.
  const tutte = (schedine as Schedina[] | null) ?? []
  const corrente = [...tutte].reverse().find(s => s.attiva !== false) ?? tutte[tutte.length - 1]
  const torneo = corrente?.torneo
  const idsTorneo = new Set(tutte.filter(s => s.torneo === torneo).map(s => s.id))
  const cl = ((classifica as ClassificaRow[]) ?? []).filter(c => idsTorneo.has(c.schedina_id))
  const clTutta = (classifica as ClassificaRow[]) ?? []

  // classifica generale per posizione
  const tot = new Map<string, number>()
  cl.forEach(c => tot.set(c.user_id, (tot.get(c.user_id) ?? 0) + c.totale))
  const generale = [...tot.entries()].sort((a, b) => b[1] - a[1])
  const myPos = generale.findIndex(([id]) => id === user.id) + 1
  const myTot = tot.get(user.id) ?? 0
  const totGiocatori = generale.length

  // righe per schedina dell'utente
  const myRows = new Map<number, ClassificaRow>()
  clTutta.forEach(c => { if (c.user_id === user.id) myRows.set(c.schedina_id, c) })
  const pronById = new Map<number, Pronostico>()
  ;(mieiPron as Pronostico[] | null)?.forEach(p => pronById.set(p.schedina_id, p))

  // badge dell'utente (calcolati su tutta la classifica)
  const sumMin = new Map<string, number>()
  cl.forEach(c => sumMin.set(c.user_id, (sumMin.get(c.user_id) ?? 0) + c.punti_minuti))
  const cecchinoId = [...sumMin.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const isVeggente = cl.some(c => c.user_id === user.id && (c.punti_bonus === 2 || c.punti_bonus >= 10))
  const badges: { Icon: typeof IconTarget; nome: string }[] = []
  if (cecchinoId === user.id && (sumMin.get(user.id) ?? 0) > 0) badges.push({ Icon: IconTarget, nome: tx('Cecchino', 'Sharpshooter') })
  if (isVeggente) badges.push({ Icon: IconStar, nome: tx('Veggente', 'Seer') })
  if (myPos === 1 && myTot > 0) badges.push({ Icon: IconCrown, nome: 'Leader' })

  // Prima della prima giornata i numeri sono tutti zero: meglio una cosa sola da fare.
  const nowIso = new Date().toISOString()
  const prossima = tutte.filter(s => s.attiva !== false && s.deadline > nowIso && !pronById.has(s.id)).sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
  const esordiente = pronById.size === 0 && myTot === 0

  const nome = profile?.username ?? tx('Giocatore', 'Player')
  const shareText = myTot > 0
    ? tx(`Sono ${myPos}° su ${totGiocatori} con ${myTot} punti a 90 & Goal: indovina il minuto del gol! https://90egoal.vercel.app`,
        `I'm ${ordinale(myPos)} of ${totGiocatori} with ${myTot} ${myTot === 1 ? 'point' : 'points'} on 90 & Goal: guess the minute of the goal! https://90egoal.vercel.app/?lang=en`)
    : tx(`Sto giocando a 90 & Goal: indovina il minuto del gol! https://90egoal.vercel.app`,
        `I'm playing 90 & Goal: guess the minute of the goal! https://90egoal.vercel.app/?lang=en`)

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      {/* Header profilo */}
      <div className="glass rounded-2xl p-6 mb-6 flex items-center gap-4">
        <div className="grid place-items-center w-16 h-16 rounded-2xl text-2xl font-extrabold text-[var(--accent-ink)] shrink-0" style={{ background: 'linear-gradient(135deg,#1aff8c,#22d3ee)' }}>
          {nome.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-bold text-2xl truncate">{nome}</h1>
          {profile?.full_name && <p className="text-[var(--muted)] text-sm">{profile.full_name}</p>}
          <p className="text-[var(--muted)] text-xs mt-0.5">{tx('Iscritto il', 'Joined on')} {profile?.created_at ? new Date(profile.created_at).toLocaleDateString(loc, { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }) : '—'}</p>
        </div>
      </div>

      {/* Esordiente: una cosa sola */}
      {esordiente && prossima && (
        <div className="glass rounded-2xl p-5 mb-6 text-center">
          <p className="text-[var(--ink)]/85">{tx('La tua prima schedina si chiude', 'Your first ticket closes on')} {new Date(prossima.deadline).toLocaleDateString(loc, { weekday: 'long', timeZone: 'Europe/Rome' })} {tx('alle', 'at')} {new Date(prossima.deadline).toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}.</p>
          <Link href={`/schedine/${prossima.id}`} className="btn-primary w-full py-3.5 mt-4">{tx('Gioca', 'Play')} {nomeSchedina(nomeBreve(prossima.nome), lingua)} →</Link>
        </div>
      )}

      {/* Numeri chiave */}
      {!esordiente && <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass rounded-2xl p-4 text-center">
          <div className="font-num font-semibold text-3xl text-gradient-gold tabular-nums">{lingua === 'en' ? (myPos ? ordinale(myPos) : '—') : `${myPos || '—'}°`}</div>
          <div className="text-[11px] text-[var(--muted)] mt-1">{tx('posizione (su', 'place (of')} {totGiocatori}){torneo ? ` · ${nomeTorneo(torneo, lingua)}` : ''}</div>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <div className="font-num font-semibold text-3xl text-gradient tabular-nums">{myTot}</div>
          <div className="text-[11px] text-[var(--muted)] mt-1">{tx('punti totali', 'total points')}</div>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <div className="font-num font-semibold text-3xl tabular-nums">{pronById.size}</div>
          <div className="text-[11px] text-[var(--muted)] mt-1">{tx('schedine giocate', 'tickets played')}</div>
        </div>
      </div>}

      {/* Badge */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {badges.map(b => (
            <span key={b.nome} className="inline-flex items-center gap-1.5 glass rounded-full px-3 py-1.5 text-sm">
              <b.Icon size={16} className="text-[var(--gold)]" /> <span className="font-semibold">{b.nome}</span>
            </span>
          ))}
        </div>
      )}

      {/* Condivisione */}
      <div className="mb-5"><ShareButton text={shareText} /></div>

      {/* Notifiche su questo dispositivo */}
      <div className="mb-7"><PushToggle /></div>

      {/* Le mie schedine */}
      {!esordiente && <h2 className="font-display font-bold text-lg mb-3">{tx('Le tue schedine', 'Your tickets')}</h2>}
      {!esordiente && <div className="space-y-3">
        {[...tutte].reverse().map(s => {
          const pron = pronById.get(s.id)
          const row = myRows.get(s.id)
          const azz = new Set(row?.minuti_azzeccati ?? [])
          if (!pron) {
            return (
              <div key={s.id} className="glass rounded-2xl p-5 flex items-center justify-between gap-3">
                <span className="text-[var(--muted)] text-sm">{nomeSchedina(nomeBreve(s.nome), lingua)} — {tx('non giocata', 'not played')}</span>
                <Link href={`/schedine/${s.id}`} className="btn-ghost px-4 py-2 text-sm">{tx('Vai →', 'Go →')}</Link>
              </div>
            )
          }
          return (
            <div key={s.id} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <span className="font-semibold">{nomeSchedina(nomeBreve(s.nome), lingua)}</span>
                {row ? (
                  <span className="font-display font-extrabold text-[var(--accent-soft)] tabular-nums">{row.totale} {tx('pt', 'pts')} <span className="text-[var(--muted)] text-xs font-normal">({row.punti_minuti}m · {row.punti_recupero}r · {row.punti_bonus}b)</span></span>
                ) : <span className="text-xs text-[var(--muted)]">{tx('in attesa risultati', 'awaiting results')}</span>}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {pron.minuti.map(m => (
                  <span key={m} className={`tag-static ${row && !azz.has(m) ? 'is-miss' : (row ? '' : 'is-miss')} px-1.5 py-0.5 text-[11px]`}>{m}&apos;</span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
                {pron.recupero && <span>{pron.recupero === 'primo' ? tx('Rec. 1°T', 'Stoppage 1H') : tx('Rec. 2°T', 'Stoppage 2H')}</span>}
                {pron.first_goal && <span className="flex items-center gap-1">{tx('Primo:', 'First:')} <Flag team={pron.first_goal} w={40} className="w-4 h-3" /><span className="text-[var(--ink)]">{pron.first_goal}</span></span>}
                {pron.last_goal && <span className="flex items-center gap-1">{tx('Ultimo:', 'Last:')} <Flag team={pron.last_goal} w={40} className="w-4 h-3" /><span className="text-[var(--ink)]">{pron.last_goal}</span></span>}
              </div>
            </div>
          )
        })}
      </div>}

      <Link href="/leghe" className="glass rounded-2xl px-4 py-3.5 mt-8 flex items-center gap-3 hover:border-[var(--ink)]">
        <IconTrophy size={20} className="text-[var(--gold)] shrink-0" />
        <span className="flex-1 min-w-0"><span className="font-semibold block">{tx('Leghe tra amici', 'Leagues with friends')}</span><span className="text-xs text-[var(--muted)]">{tx('Una classifica solo per il vostro gruppo', 'Standings just for your group')}</span></span>
        <span className="text-[var(--muted)]">→</span>
      </Link>

      <div className="glass rounded-2xl px-4 py-3 mt-3 flex items-center justify-between gap-3">
        <span className="font-semibold text-sm">Lingua <span className="text-[var(--muted)] font-normal">/ Language</span></span>
        <CambiaLingua />
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[var(--line)] pt-5 text-sm">
        <Link href="/regole" className="text-[var(--muted)] hover:text-[var(--ink)] flex items-center gap-1.5"><IconBook size={16} /> {tx('Regole del gioco', 'Rules of the game')}</Link>
        <LogoutButton className="btn-ghost px-5 py-2 text-sm" />
      </div>
    </div>
  )
}
