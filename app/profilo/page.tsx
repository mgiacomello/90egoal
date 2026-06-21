import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClassificaRow, Pronostico, Schedina, Profile } from '@/lib/types'
import Flag from '@/components/Flag'
import ShareButton from '@/components/ShareButton'

export default async function ProfiloPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: prof }, { data: classifica }, { data: schedine }, { data: mieiPron }] = await Promise.all([
    supabase.from('profiles').select('id, username, full_name, email, created_at').eq('id', user.id).single(),
    supabase.from('classifica').select('*'),
    supabase.from('schedine').select('id, nome').order('id'),
    supabase.from('pronostici').select('*').eq('user_id', user.id),
  ])

  const profile = prof as Profile | null
  const cl = (classifica as ClassificaRow[]) ?? []

  // classifica generale per posizione
  const tot = new Map<string, number>()
  cl.forEach(c => tot.set(c.user_id, (tot.get(c.user_id) ?? 0) + c.totale))
  const generale = [...tot.entries()].sort((a, b) => b[1] - a[1])
  const myPos = generale.findIndex(([id]) => id === user.id) + 1
  const myTot = tot.get(user.id) ?? 0
  const totGiocatori = generale.length

  // righe per schedina dell'utente
  const myRows = new Map<number, ClassificaRow>()
  cl.forEach(c => { if (c.user_id === user.id) myRows.set(c.schedina_id, c) })
  const pronById = new Map<number, Pronostico>()
  ;(mieiPron as Pronostico[] | null)?.forEach(p => pronById.set(p.schedina_id, p))

  // badge dell'utente (calcolati su tutta la classifica)
  const sumMin = new Map<string, number>()
  cl.forEach(c => sumMin.set(c.user_id, (sumMin.get(c.user_id) ?? 0) + c.punti_minuti))
  const cecchinoId = [...sumMin.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const isVeggente = cl.some(c => c.user_id === user.id && c.punti_bonus >= 10)
  const badges: { icon: string; nome: string }[] = []
  if (cecchinoId === user.id && (sumMin.get(user.id) ?? 0) > 0) badges.push({ icon: '🎯', nome: 'Cecchino' })
  if (isVeggente) badges.push({ icon: '🔮', nome: 'Veggente' })
  if (myPos === 1 && myTot > 0) badges.push({ icon: '👑', nome: 'Leader' })

  const nome = profile?.username ?? 'Giocatore'
  const shareText = myTot > 0
    ? `⚽ Sono ${myPos}° su ${totGiocatori} con ${myTot} punti a 90 & Goal — i pronostici sui gol dei Mondiali! Gioca anche tu: https://90egoal.vercel.app`
    : `⚽ Sto giocando a 90 & Goal, i pronostici sui minuti dei gol dei Mondiali! Gioca anche tu: https://90egoal.vercel.app`

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      {/* Header profilo */}
      <div className="glass rounded-2xl p-6 mb-6 flex items-center gap-4">
        <div className="grid place-items-center w-16 h-16 rounded-2xl text-2xl font-extrabold text-[#04130b] shrink-0" style={{ background: 'linear-gradient(135deg,#1aff8c,#22d3ee)' }}>
          {nome.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-bold text-2xl truncate">{nome}</h1>
          {profile?.full_name && <p className="text-[var(--muted)] text-sm">{profile.full_name}</p>}
          <p className="text-[var(--muted)] text-xs mt-0.5">Iscritto il {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }) : '—'}</p>
        </div>
      </div>

      {/* Numeri chiave */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass rounded-2xl p-4 text-center">
          <div className="font-display font-extrabold text-3xl text-gradient-gold tabular-nums">{myPos || '—'}°</div>
          <div className="text-[11px] text-[var(--muted)] mt-1">posizione (su {totGiocatori})</div>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <div className="font-display font-extrabold text-3xl text-gradient tabular-nums">{myTot}</div>
          <div className="text-[11px] text-[var(--muted)] mt-1">punti totali</div>
        </div>
        <div className="glass rounded-2xl p-4 text-center">
          <div className="font-display font-extrabold text-3xl tabular-nums">{pronById.size}</div>
          <div className="text-[11px] text-[var(--muted)] mt-1">schedine giocate</div>
        </div>
      </div>

      {/* Badge */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {badges.map(b => (
            <span key={b.nome} className="inline-flex items-center gap-1.5 glass rounded-full px-3 py-1.5 text-sm">
              <span className="text-base">{b.icon}</span> <span className="font-semibold">{b.nome}</span>
            </span>
          ))}
        </div>
      )}

      {/* Condivisione */}
      <div className="mb-7"><ShareButton text={shareText} /></div>

      {/* Le mie schedine */}
      <h2 className="font-display font-bold text-lg mb-3">Le tue schedine</h2>
      <div className="space-y-3">
        {schedine?.map(s => {
          const pron = pronById.get(s.id)
          const row = myRows.get(s.id)
          const azz = new Set(row?.minuti_azzeccati ?? [])
          if (!pron) {
            return (
              <div key={s.id} className="glass rounded-2xl p-5 flex items-center justify-between gap-3">
                <span className="text-[var(--muted)] text-sm">{s.nome.replace(' — Mondiali FIFA 2026', '')} — non giocata</span>
                <Link href={`/schedine/${s.id}`} className="btn-ghost px-4 py-2 text-sm">Vai →</Link>
              </div>
            )
          }
          return (
            <div key={s.id} className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <span className="font-semibold">{s.nome.replace(' — Mondiali FIFA 2026', '')}</span>
                {row ? (
                  <span className="font-display font-extrabold text-[var(--accent-soft)] tabular-nums">{row.totale} pt <span className="text-[var(--muted)] text-xs font-normal">({row.punti_minuti}m · {row.punti_recupero}r · {row.punti_bonus}b)</span></span>
                ) : <span className="text-xs text-[var(--muted)]">in attesa risultati</span>}
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {pron.minuti.map(m => (
                  <span key={m} className={`tag-static ${row && !azz.has(m) ? 'is-miss' : (row ? '' : 'is-miss')} px-1.5 py-0.5 text-[11px]`}>{m}&apos;</span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
                {pron.recupero && <span>➕ {pron.recupero === 'primo' ? 'Rec. 1°T' : 'Rec. 2°T'}</span>}
                {pron.first_goal && <span className="flex items-center gap-1">🥇 <Flag team={pron.first_goal} w={40} className="w-4 h-3" /><span className="text-white/80">{pron.first_goal}</span></span>}
                {pron.last_goal && <span className="flex items-center gap-1">🏁 <Flag team={pron.last_goal} w={40} className="w-4 h-3" /><span className="text-white/80">{pron.last_goal}</span></span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
