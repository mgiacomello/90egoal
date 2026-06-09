import { Schedina, Pronostico, Profile, Risultato, ClassificaRow } from '@/lib/types'
import Flag from '@/components/Flag'

interface Props {
  schedine: Schedina[]
  profiles: Profile[]
  pronostici: Pronostico[]
  risultatiMap: Record<number, Risultato>
  classifica: ClassificaRow[]
}

export default function AdminStats({ schedine, profiles, pronostici, risultatiMap, classifica }: Props) {
  const totUtenti = profiles.length
  const totPronostici = pronostici.length

  const profileById = new Map(profiles.map(p => [p.id, p]))
  // punti per (schedina_id + user_id)
  const puntiByKey = new Map<string, ClassificaRow>()
  classifica.forEach(c => puntiByKey.set(`${c.schedina_id}:${c.user_id}`, c))

  return (
    <div>
      <div className="mb-6">
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Cruscotto</span>
        <h2 className="font-display font-bold text-2xl sm:text-3xl mt-1">Statistiche &amp; pronostici</h2>
        <p className="text-[var(--muted)] text-sm mt-1">Tutti gli utenti registrati e le loro giocate.</p>
      </div>

      {/* Stat overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard n={totUtenti} l="Utenti registrati" />
        <StatCard n={totPronostici} l="Pronostici totali" />
        {schedine.map(s => (
          <StatCard
            key={s.id}
            n={pronostici.filter(p => p.schedina_id === s.id).length}
            l={`Compilati · ${s.nome.replace(' — Mondiali FIFA 2026', '')}`}
          />
        ))}
      </div>

      {/* Per schedina */}
      {schedine.map(s => {
        const risultato = risultatiMap[s.id]
        const giocate = pronostici
          .filter(p => p.schedina_id === s.id)
          .sort((a, b) => {
            const pa = puntiByKey.get(`${s.id}:${a.user_id}`)?.totale ?? -1
            const pb = puntiByKey.get(`${s.id}:${b.user_id}`)?.totale ?? -1
            if (pa !== pb) return pb - pa
            return (a.submitted_at ?? '').localeCompare(b.submitted_at ?? '')
          })
        const idsGiocato = new Set(giocate.map(g => g.user_id))
        const nonGiocato = profiles.filter(p => !p.is_admin && !idsGiocato.has(p.id))

        return (
          <section key={s.id} className="mb-10">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-display font-bold text-lg">{s.nome.replace(' — Mondiali FIFA 2026', '')}</h3>
              <span className="text-xs text-[var(--muted)]">
                {giocate.length} giocate{risultato ? ' · risultati pubblicati' : ' · in attesa di risultati'}
              </span>
            </div>

            {giocate.length === 0 ? (
              <div className="glass rounded-2xl p-6 text-center text-[var(--muted)] text-sm">Nessuna giocata per ora.</div>
            ) : (
              <div className="space-y-3">
                {giocate.map(g => {
                  const prof = profileById.get(g.user_id)
                  const punti = puntiByKey.get(`${s.id}:${g.user_id}`)
                  return (
                    <div key={g.id} className="glass rounded-2xl p-5">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <div>
                          <span className="font-semibold">{prof?.username ?? 'utente'}</span>
                          {prof?.full_name && <span className="text-[var(--muted)] text-sm ml-2">{prof.full_name}</span>}
                        </div>
                        {punti ? (
                          <span className="font-display font-extrabold text-[var(--accent-soft)] text-lg tabular-nums">
                            {punti.totale} pt
                            <span className="text-[var(--muted)] text-xs font-normal ml-2">
                              ({punti.punti_minuti} min · {punti.punti_recupero} rec · {punti.punti_bonus} bonus)
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">in attesa risultati</span>
                        )}
                      </div>

                      {/* Minuti */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {g.minuti.map(m => {
                          const miss = !!risultato && !risultato.minuti_gol.includes(m)
                          return <span key={m} className={`tag-static ${miss ? 'is-miss' : ''} px-2 py-0.5 text-xs`}>{m}&apos;</span>
                        })}
                      </div>

                      {/* Recupero + squadre */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--muted)]">
                        {g.recupero && <span>➕ Recupero: <span className="text-white">{g.recupero === 'primo' ? '1° tempo' : '2° tempo'}</span></span>}
                        {g.first_goal && <span className="flex items-center gap-1.5">🥇 <Flag team={g.first_goal} w={40} className="w-5 h-3.5" /><span className="text-white">{g.first_goal}</span></span>}
                        {g.last_goal && <span className="flex items-center gap-1.5">🏁 <Flag team={g.last_goal} w={40} className="w-5 h-3.5" /><span className="text-white">{g.last_goal}</span></span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {nonGiocato.length > 0 && (
              <p className="text-xs text-[var(--muted)] mt-3">
                <span className="text-white/60 font-medium">Non hanno ancora giocato ({nonGiocato.length}):</span>{' '}
                {nonGiocato.map(p => p.username).join(', ')}
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function StatCard({ n, l }: { n: number; l: string }) {
  return (
    <div className="glass rounded-2xl p-4 text-center">
      <div className="font-display font-extrabold text-3xl text-gradient tabular-nums">{n}</div>
      <div className="text-[11px] text-[var(--muted)] mt-1 leading-tight">{l}</div>
    </div>
  )
}
