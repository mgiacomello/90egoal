import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Schedina, Pronostico, ClassificaRow } from '@/lib/types'
import LiveRefresh from '@/components/LiveRefresh'
import SchedinaCard from '@/components/SchedinaCard'
import PushToggle from '@/components/PushToggle'
import { IconTicket } from '@/components/Icons'
import { inCorso } from '@/lib/giornata'

export default async function SchedinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: schedine } = await supabase.from('schedine').select('*').order('id')
  const { data: mieiPronostici } = await supabase.from('pronostici').select('*').eq('user_id', user.id)
  const { data: risultati } = await supabase.from('risultati').select('*')
  // I miei punti schedina per schedina: si aggiornano anche durante il live.
  const { data: mieiPunti } = await supabase.from('classifica').select('schedina_id, totale').eq('user_id', user.id)
  const puntiMap = new Map(((mieiPunti ?? []) as Pick<ClassificaRow, 'schedina_id' | 'totale'>[]).map(r => [r.schedina_id, r.totale]))

  const pronosticoMap = new Map<number, Pronostico>()
  mieiPronostici?.forEach(p => pronosticoMap.set(p.schedina_id, p))
  const risultatoMap = new Map(risultati?.map(r => [r.schedina_id, r]) ?? [])

  const now = new Date()
  const tutte = (schedine as Schedina[] | null) ?? []
  // La prossima a scadere in cima.
  const attive = tutte.filter(s => s.attiva !== false).sort((a, b) => a.deadline.localeCompare(b.deadline))
  const torneiVivi = new Set(attive.map(s => s.torneo ?? ''))
  const torneiFiniti = [...new Set(tutte.filter(s => s.attiva === false).map(s => s.torneo ?? ''))].filter(t => t && !torneiVivi.has(t))
  // Con una schedina per serie l'elenco si allunga: in alto quelle di adesso (in corso o che
  // chiudono entro otto giorni), poi quelle più avanti, in fondo le giornate già chiuse.
  const nowIso = now.toISOString()
  const fra8 = new Date(now.getTime() + 8 * 24 * 3600 * 1000).toISOString()
  const finitaTutta = (s: Schedina) => {
    const d = ((risultatoMap.get(s.id)?.dettagli ?? []) as { stato?: string }[])
    return d.filter(x => (x.stato ?? 'finita') === 'finita').length === s.partite.length
  }
  const adesso = attive.filter(s => (s.deadline > nowIso && s.deadline <= fra8) || inCorso(s, nowIso, finitaTutta(s)))
  const idAdesso = new Set(adesso.map(s => s.id))
  const piuAvanti = attive.filter(s => s.deadline > fra8)
  // Giornate giocate: quelle chiuse del torneo in corso, comprese le archiviate. Le più recenti in cima.
  const archiviateVive = tutte.filter(s => s.attiva === false && torneiVivi.has(s.torneo ?? ''))
  const chiuse = [...attive.filter(s => s.deadline <= nowIso && !idAdesso.has(s.id)), ...archiviateVive].sort((a, b) => b.deadline.localeCompare(a.deadline))
  // Il pulsante "Aggiorna" ha senso solo mentre si gioca.
  const inDiretta = attive.some(s => {
    const r = risultatoMap.get(s.id)
    if (!r || s.deadline > now.toISOString()) return false
    const d = (r.dettagli ?? []) as { stato?: string }[]
    return d.filter(x => (x.stato ?? 'finita') === 'finita').length < s.partite.length
  })

  return (
    <div className="animate-fade-up max-w-lg mx-auto">
      {inDiretta && <LiveRefresh seconds={60} generatedAt={now.toISOString()} />}
      <PushToggle variant="banner" />
      <div className="mb-5">
        <h1 className="font-display font-bold text-2xl sm:text-3xl">Schedine</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Una per serie a ogni giornata. Si gioca fino al primo calcio d&apos;inizio.</p>
      </div>

      {attive.length === 0 && chiuse.length === 0 ? (
        <div className="glass rounded-2xl py-16 text-center">
          <IconTicket size={36} className="inline-block text-[var(--accent)] mb-4" strokeWidth={1.6} />
          <p className="text-[var(--muted)]">Nessuna schedina attiva al momento.<br />Le prossime arriveranno a breve.</p>
        </div>
      ) : (
        <>
          {adesso.length > 0 && (
            <div className="space-y-3 stagger">
              {adesso.map(s => (
                <SchedinaCard key={s.id} schedina={s} pronostico={pronosticoMap.get(s.id)} risultato={risultatoMap.get(s.id)} now={now} punti={puntiMap.get(s.id)} />
              ))}
            </div>
          )}
          {[{ titolo: 'Più avanti', lista: piuAvanti, aperto: adesso.length === 0 }, { titolo: 'Giornate giocate', lista: chiuse, aperto: adesso.length === 0 && piuAvanti.length === 0 }].map(g => g.lista.length > 0 && (
            <details key={g.titolo} className="mt-6 group" open={g.aperto}>
              <summary className="cursor-pointer list-none flex items-center justify-between py-2 select-none">
                <span className="text-xs font-semibold tracking-widest text-[var(--muted)] uppercase">{g.titolo} · {g.lista.length}</span>
                <span className="text-[var(--muted)] text-xs transition-transform group-open:rotate-90">▶</span>
              </summary>
              <div className="space-y-3 mt-2">
                {g.lista.map(s => (
                  <SchedinaCard key={s.id} schedina={s} pronostico={pronosticoMap.get(s.id)} risultato={risultatoMap.get(s.id)} now={now} punti={puntiMap.get(s.id)} />
                ))}
              </div>
            </details>
          ))}
        </>
      )}

      {/* I tornei finiti (i Mondiali) non stanno più in elenco: una riga li ricorda. */}
      {torneiFiniti.map(t => (
        <p key={t} className="text-xs text-[var(--muted)] text-center mt-10">
          Si è giocato anche ai {t}. <Link href={`/classifica?torneo=${encodeURIComponent(t)}`} className="underline">Com&apos;è finita</Link>
        </p>
      ))}
    </div>
  )
}
