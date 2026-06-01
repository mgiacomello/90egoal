import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Schedina, Pronostico } from '@/lib/types'
import Flag from '@/components/Flag'
import { stadiumImage } from '@/lib/stadiums'

export default async function SchedinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: schedine } = await supabase.from('schedine').select('*').order('id')
  const { data: mieiPronostici } = await supabase.from('pronostici').select('*').eq('user_id', user!.id)
  const { data: risultati } = await supabase.from('risultati').select('*')

  const pronosticoMap = new Map<number, Pronostico>()
  mieiPronostici?.forEach(p => pronosticoMap.set(p.schedina_id, p))
  const risultatoMap = new Map(risultati?.map(r => [r.schedina_id, r]) ?? [])

  const now = new Date()

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <span className="text-xs font-semibold tracking-widest text-[var(--accent)] uppercase">Le tue schedine</span>
        <h1 className="font-display font-bold text-3xl sm:text-4xl mt-2">Compila i pronostici</h1>
        <p className="text-[var(--muted)] mt-2">Inserisci i tuoi pronostici prima della scadenza di ogni schedina.</p>
      </div>

      <div className="space-y-5 stagger">
        {schedine?.map((s: Schedina) => {
          const pronostico = pronosticoMap.get(s.id)
          const risultato = risultatoMap.get(s.id)
          const deadline = new Date(s.deadline)
          const isScaduta = now > deadline
          const isCompilata = !!pronostico
          const giorni = Math.ceil((deadline.getTime() - now.getTime()) / 86400000)

          return (
            <div key={s.id} className="glass glass-hover rounded-2xl overflow-hidden">
              {/* Banner stadio */}
              <div className="relative h-40 sm:h-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stadiumImage(s.id)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/60 to-[#0d1117]/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117]/80 to-transparent" />

                {/* Badge stato in alto */}
                <div className="absolute top-4 left-5 flex items-center gap-2">
                  {isCompilata && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-soft)] bg-black/40 backdrop-blur border border-[var(--accent)]/40 px-2.5 py-1 rounded-full">
                      ✓ Compilata
                    </span>
                  )}
                  {!isScaduta && !isCompilata && giorni <= 3 && (
                    <span className="text-xs font-semibold text-[var(--gold)] bg-black/40 backdrop-blur border border-[var(--gold)]/40 px-2.5 py-1 rounded-full animate-pulse-glow">
                      ⏳ {giorni === 1 ? 'Ultimo giorno' : `${giorni} giorni rimasti`}
                    </span>
                  )}
                  {isScaduta && (
                    <span className="text-xs font-semibold text-red-300 bg-black/40 backdrop-blur border border-red-500/40 px-2.5 py-1 rounded-full">
                      Chiusa
                    </span>
                  )}
                </div>

                {/* Titolo + CTA sovrapposti */}
                <div className="absolute bottom-0 inset-x-0 p-5 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-display font-bold text-2xl drop-shadow-lg">{s.nome.replace(' — Mondiali FIFA 2026', '')}</h2>
                    <p className="text-sm mt-0.5">
                      {isScaduta ? (
                        <span className="text-red-300/90">Chiusa il {deadline.toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })}</span>
                      ) : (
                        <span className="text-white/70">Scadenza <span className="text-white font-medium">{deadline.toLocaleDateString('it-IT', { day: '2-digit', month: 'long' })} · 24:00</span></span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {!isScaduta ? (
                      <Link href={`/schedine/${s.id}`} className={isCompilata ? 'btn-ghost px-5 py-2.5 text-sm' : 'btn-primary px-5 py-2.5 text-sm'}>
                        {isCompilata ? 'Modifica' : 'Compila ora →'}
                      </Link>
                    ) : (
                      <span className="text-white/60 text-sm px-2">{isCompilata ? 'Inviata' : 'Non giocata'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Mini-griglia partite */}
              <div className="p-6 pt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                {s.partite.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm py-0.5">
                    <span className="text-xs text-[var(--muted)] w-11 shrink-0 tabular-nums">
                      {new Date(p.date + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                    </span>
                    <Flag team={p.home} w={40} className="w-5 h-3.5 shrink-0" />
                    <span className="text-white/85 truncate">{p.home}</span>
                    <span className="text-white/25 text-xs">vs</span>
                    <Flag team={p.away} w={40} className="w-5 h-3.5 shrink-0" />
                    <span className="text-white/85 truncate">{p.away}</span>
                  </div>
                ))}
              </div>

              {/* Risultati / punteggio */}
              {risultato && isCompilata && (
                <div className="mx-6 mb-6 pt-4 border-t border-white/8">
                  <p className="text-xs text-[var(--muted)] mb-2 uppercase tracking-wider font-semibold">I tuoi minuti vs risultati</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pronostico.minuti.map((m: number) => {
                      const ok = risultato.minuti_gol.includes(m)
                      return (
                        <span key={m} className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold ${ok ? 'bg-[var(--accent)]/15 text-[var(--accent-soft)] border border-[var(--accent)]/40' : 'bg-white/5 text-white/30 line-through'}`}>
                          {m}&apos;
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
