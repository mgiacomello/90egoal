import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ClassificaRow, MatchDetail, Partita } from '@/lib/types'
import LiveRefresh from '@/components/LiveRefresh'
import ClassificaVista, { type GiornataVista } from '@/components/ClassificaVista'
import { IconTrophy, IconPlus } from '@/components/Icons'
import { mieLeghe } from '@/lib/leghe'
import { serieDi } from '@/lib/feed'
import { inCorso } from '@/lib/giornata'
import { txServer } from '@/lib/lingua.server'
import { localeDi, nomeTorneo } from '@/lib/lingua'

interface SchedinaLite { id: number; nome: string; attiva: boolean; torneo?: string; partite: Partita[]; deadline: string }

export default async function ClassificaPage({ searchParams }: { searchParams: Promise<{ torneo?: string; lega?: string; serie?: string; g?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const params = await searchParams
  const { lingua, tx } = await txServer()

  const { data: tutteSchedine } = await supabase.from('schedine').select('*').order('id')
  const { data: tuttaClassifica } = await supabase.from('classifica').select('*')
  const { data: risultati } = await supabase.from('risultati').select('schedina_id, dettagli')

  // Un torneo alla volta: la classifica generale somma solo le sue schedine.
  const all = (tutteSchedine ?? []) as SchedinaLite[]
  const torneoDi = (s: SchedinaLite) => s.torneo ?? ''
  const tornei = [...new Set(all.map(torneoDi))]
  // Un torneo finito (tutte le schedine in archivio, come i Mondiali) esce dai pulsanti:
  // resta una riga in fondo, per chi vuole rivedere com'è andata.
  const inCorsoT = tornei.filter(t => all.some(s => torneoDi(s) === t && s.attiva !== false))
  const finiti = tornei.filter(t => t && !inCorsoT.includes(t))
  const corrente = [...all].reverse().find(s => s.attiva !== false)
  const torneo = params.torneo && tornei.includes(params.torneo) ? params.torneo : corrente ? torneoDi(corrente) : tornei[tornei.length - 1] ?? ''
  const schedine = all.filter(s => torneoDi(s) === torneo).reverse()
  const ids = new Set(schedine.map(s => s.id))
  // Leghe tra amici: stessa classifica del torneo, filtrata sui membri della lega scelta.
  const leghe = user ? await mieLeghe(supabase, user.id) : []
  const lega = leghe.find(l => l.id === params.lega) ?? null
  const membri = lega ? new Set(lega.membri) : null
  const classifica = ((tuttaClassifica ?? []) as ClassificaRow[]).filter(r => ids.has(r.schedina_id) && (!membri || membri.has(r.user_id)))
  const qs = (t: string, l: string | null, extra?: { serie: string | null; g: number | null }) => {
    const u = new URLSearchParams()
    if (t) u.set('torneo', t)
    if (l) u.set('lega', l)
    if (extra?.serie) u.set('serie', extra.serie)
    if (extra?.g) u.set('g', String(extra.g))
    const q = u.toString()
    return q ? `/classifica?${q}` : '/classifica'
  }
  const limite = lega ? 200 : 10

  const risMap = new Map(((risultati ?? []) as { schedina_id: number; dettagli: MatchDetail[] | null }[]).map(r => [r.schedina_id, r.dettagli ?? []]))
  // Quando si parte: la prima scadenza ancora da venire, detta come la direbbe una persona.
  const nowIso = new Date().toISOString()
  const prossima = all.filter(s => s.attiva !== false && s.deadline > nowIso).sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
  const prossimaApertura = prossima
    ? `${new Date(prossima.deadline).toLocaleDateString(localeDi(lingua), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' })} ${tx('alle', 'at')} ${new Date(prossima.deadline).toLocaleTimeString(localeDi(lingua), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}`
    : null

  // Per ogni giornata: di che serie è, se è finita, se si sta giocando.
  const giornate: GiornataVista[] = schedine.map(s => {
    const d = risMap.get(s.id)
    const finite = d ? d.filter(x => (x.stato ?? 'finita') === 'finita').length : 0
    const conclusa = s.attiva === false || (!!d && s.partite.length > 0 && finite === s.partite.length)
    // "In corso" solo a ridosso delle partite: una giornata vecchia rimasta a metà non lampeggia per sempre.
    return { id: s.id, nome: s.nome, serie: serieDi(s.partite[0]?.competizione), deadline: s.deadline, conclusa, live: !!d && inCorso(s, nowIso, conclusa) }
  })
  // Provvisoria finché una giornata si sta giocando.
  const provvisoria = giornate.some(g => g.live)
  const serie = ['A', 'B', 'C'].includes(params.serie ?? '') ? params.serie! : null
  const giornataId = params.g && /^\d+$/.test(params.g) ? Number(params.g) : null

  return (
    <div className="animate-fade-up">
      <div className="mb-5">
        <h1 className="font-display font-bold text-2xl sm:text-3xl break-words">{lega ? lega.nome : tx('Classifica', 'Standings')}</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          {lega && <>{tx('Lega', 'League')} · {lega.membri.length} {lega.membri.length === 1 ? tx('giocatore', 'player') : tx('giocatori', 'players')}{torneo && ' · '}</>}
          {nomeTorneo(torneo, lingua)}
          {lega && <> · <Link href={`/leghe/${lega.id}`} className="text-[var(--accent-soft)] hover:underline">{tx('Invita', 'Invite')}</Link></>}
        </p>
      </div>

      {user && (
        <div className="flex gap-2 mb-3 -mx-4 px-4 overflow-x-auto [scrollbar-width:none]" aria-label={tx('Classifica di', 'Standings for')}>
          <Link href={qs(torneo, null)} className={`seg-btn px-3 py-1.5 text-sm shrink-0 ${!lega ? 'is-active' : ''}`}>{tx('Tutti', 'Everyone')}</Link>
          {leghe.map(l => (
            <Link key={l.id} href={qs(torneo, l.id)} className={`seg-btn px-3 py-1.5 text-sm shrink-0 max-w-[11rem] truncate ${lega?.id === l.id ? 'is-active' : ''}`}>{l.nome}</Link>
          ))}
          <Link href="/leghe" className="seg-btn px-3 py-1.5 text-sm shrink-0 flex items-center gap-1 text-[var(--muted)]"><IconPlus size={14} /> {leghe.length ? tx('Lega', 'League') : tx('Crea una lega con gli amici', 'Create a league with friends')}</Link>
        </div>
      )}

      {inCorsoT.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {[...inCorsoT].reverse().map(t => (
            <Link key={t || 'nessuno'} href={qs(t, lega?.id ?? null)} className={`seg-btn px-3 py-1.5 text-sm ${t === torneo ? 'is-active' : ''}`}>
              {t ? nomeTorneo(t, lingua) : tx('Altro', 'Other')}
            </Link>
          ))}
        </div>
      )}

      {provvisoria && <LiveRefresh seconds={60} generatedAt={new Date().toISOString()} />}
      {provvisoria && (
        <p className="text-xs text-[var(--danger)] bg-[var(--danger-soft)] border border-[var(--danger)]/30 rounded-xl px-3 py-2 mb-5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--danger)] animate-pulse-glow shrink-0" />
          <span>{tx('Si sta giocando: i punti cambiano a ogni gol. La classifica diventa definitiva al fischio finale.', 'Matches are under way: points change with every goal. The standings become final at the last whistle.')}</span>
        </p>
      )}

      {lega && lega.membri.length < 2 ? (
        <div className="glass rounded-2xl py-10 px-6 text-center">
          <IconTrophy size={36} className="inline-block text-[var(--accent)] mb-4" strokeWidth={1.6} />
          <p className="text-[var(--ink)]/85">{tx('Per ora ci sei solo tu.', 'It’s just you for now.')}<br /><span className="text-[var(--muted)]">{tx('Manda il link al gruppo: la classifica si riempie da sola.', 'Send the link to your group: the standings will fill up by themselves.')}</span></p>
          <Link href={`/leghe/${lega.id}`} className="btn-primary px-5 py-2.5 text-sm mt-5 inline-flex">{tx('Invita gli amici', 'Invite your friends')}</Link>
        </div>
      ) : classifica.length === 0 ? (
        <div className="glass rounded-2xl py-14 px-6 text-center">
          <IconTrophy size={36} className="inline-block text-[var(--accent)] mb-4" strokeWidth={1.6} />
          {prossimaApertura ? (
            <p className="text-[var(--ink)]/85">{tx('Si parte', 'We start on')} {prossimaApertura}.<br /><span className="text-[var(--muted)]">{tx('Qui vedrai i punti salire a ogni gol.', 'Here you’ll see the points go up with every goal.')}</span></p>
          ) : (
            <p className="text-[var(--muted)]">{tx('I punti compaiono qui durante le partite.', 'Points appear here during the matches.')}</p>
          )}
        </div>
      ) : (
        <ClassificaVista
          righe={classifica}
          giornate={giornate}
          userId={user?.id}
          serie={serie}
          giornataId={giornataId}
          href={o => qs(torneo, lega?.id ?? null, o)}
          cima={limite}
          titolo={lega ? tx('Classifica della lega', 'League standings') : tx('Classifica generale', 'Overall standings')}
          lingua={lingua}
        />
      )}

      {finiti.filter(t => t !== torneo).map(t => (
        <p key={t} className="text-xs text-[var(--muted)] text-center mt-6">
          {tx(`Si è giocato anche ai ${t}.`, `We also played the ${nomeTorneo(t, lingua)}.`)} <Link href={qs(t, null)} className="underline">{tx('Com\'è finita', 'How it ended')}</Link>
        </p>
      ))}
      {finiti.includes(torneo) && (
        <p className="text-xs text-[var(--muted)] text-center mt-6">
          {tx('Torneo concluso.', 'Tournament over.')} <Link href="/classifica" className="underline">{tx('Torna alla classifica di oggi', 'Back to the current standings')}</Link>
        </p>
      )}
    </div>
  )
}
